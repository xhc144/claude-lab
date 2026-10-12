// WebGL2 renderer: sky, terrain sections (opaque+cutout, then translucent), clouds, entities,
// particles, selection outline and the first-person hand. Everything is drawn camera-relative.

import { Program, createTextureArray, createTexture2D } from './gl.js';
import * as SH from './shaders.js';
import { buildBlockTextures, buildMips } from './textures.js';
import { VERTEX_BYTES } from './mesher.js';
import { mat4, perspective, multiply, invert, fpsView, frustumPlanes, aabbInFrustum, identity } from '../core/math.js';
import { tileNoise } from '../core/noise.js';

const MAX_QUADS = 131072;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: true, stencil: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    if (!gl) throw new Error('WebGL2 不可用');
    this.gl = gl;
    this.scale = 1;
    this.fov = 75 * Math.PI / 180;
    this.renderDist = 8;
    this.gamma = 1;
    this.proj = mat4(); this.view = mat4(); this.vp = mat4(); this.inv = mat4(); this.viewRot = mat4(); this.vpRot = mat4();
    this.planes = new Float32Array(24);
    this.sections = new Set();
    this.stats = { sections: 0, drawn: 0, tris: 0 };

    this.terrain = new Program(gl, SH.TERRAIN_VS, SH.TERRAIN_FS, 'terrain');
    this.sky = new Program(gl, SH.SKY_VS, SH.SKY_FS, 'sky');
    this.cloud = new Program(gl, SH.CLOUD_VS, SH.CLOUD_FS, 'cloud');
    this.line = new Program(gl, SH.LINE_VS, SH.LINE_FS, 'line');
    this.entity = new Program(gl, SH.ENTITY_VS, SH.ENTITY_FS, 'entity');
    this.particle = new Program(gl, SH.PARTICLE_VS, SH.PARTICLE_FS, 'particle');

    // block textures
    const tex = buildBlockTextures();
    this.texInfo = tex;
    const mips = buildMips(tex.data, tex.layers, tex.size);
    this.blockTex = createTextureArray(gl, tex.size, tex.layers, mips);

    // shared quad index buffer
    const idx = new Uint32Array(MAX_QUADS * 6);
    for (let q = 0; q < MAX_QUADS; q++) {
      const v = q * 4, i = q * 6;
      idx[i] = v; idx[i + 1] = v + 1; idx[i + 2] = v + 2; idx[i + 3] = v; idx[i + 4] = v + 2; idx[i + 5] = v + 3;
    }
    this.quadIndex = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.quadIndex);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);

    // full-screen triangle-pair and cloud plane
    this.fsq = this.makeQuadVAO([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]);

    // cloud noise texture
    const N = 256, nz = tileNoise(9137, 16), nz2 = tileNoise(5521, 32);
    const nd = new Uint8Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const v = nz(x / 16, y / 16) * 0.7 + nz2(x / 8, y / 8) * 0.3;
      nd[y * N + x] = Math.max(0, Math.min(255, v * 255));
    }
    this.noiseTex = createTexture2D(gl, N, N, nd, { format: 'r8', filter: 'linear', wrap: 'repeat', mip: true });

    // dynamic line buffer
    this.lineVAO = gl.createVertexArray();
    this.lineVBO = gl.createBuffer();
    gl.bindVertexArray(this.lineVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lineVBO);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 28, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 28, 12);
    gl.bindVertexArray(null);

    // particles (instanced)
    this.partVAO = gl.createVertexArray();
    this.partCorner = gl.createBuffer();
    this.partInst = gl.createBuffer();
    gl.bindVertexArray(this.partVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.partCorner);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.partInst);
    const st = 14 * 4;
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, st, 0); gl.vertexAttribDivisor(0, 1);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, st, 12); gl.vertexAttribDivisor(2, 1);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 4, gl.FLOAT, false, st, 28); gl.vertexAttribDivisor(3, 1);
    gl.enableVertexAttribArray(4); gl.vertexAttribPointer(4, 2, gl.FLOAT, false, st, 44); gl.vertexAttribDivisor(4, 1);
    gl.bindVertexArray(null);
    this.partData = new Float32Array(14 * 4096);

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.frontFace(gl.CCW);
    this.resize();
  }

  makeQuadVAO(verts) {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    const vbo = gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    return vao;
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2) * this.scale;
    const w = Math.max(1, Math.floor(this.canvas.clientWidth * dpr));
    const h = Math.max(1, Math.floor(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w; this.canvas.height = h;
    }
    this.width = w; this.height = h;
  }

  // ---------------------------------------------------------------- section meshes
  uploadSection(chunk, sy, data) {
    const gl = this.gl;
    let m = chunk.meshes[sy];
    if (!m) {
      m = { cx: chunk.cx, cz: chunk.cz, sy, o: null, t: null };
      chunk.meshes[sy] = m;
      this.sections.add(m);
    }
    m.o = this.uploadPart(m.o, data.opaque);
    m.t = this.uploadPart(m.t, data.trans);
    if (!m.o && !m.t) { this.sections.delete(m); chunk.meshes[sy] = null; }
  }

  uploadPart(part, d) {
    const gl = this.gl;
    if (!d || !d.count) {
      if (part) { gl.deleteBuffer(part.vbo); gl.deleteVertexArray(part.vao); }
      return null;
    }
    if (!part) {
      part = { vao: gl.createVertexArray(), vbo: gl.createBuffer(), count: 0 };
      gl.bindVertexArray(part.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, part.vbo);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 4, gl.SHORT, false, VERTEX_BYTES, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.UNSIGNED_BYTE, false, VERTEX_BYTES, 8);
      gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.UNSIGNED_BYTE, true, VERTEX_BYTES, 12);
      gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 4, gl.UNSIGNED_BYTE, true, VERTEX_BYTES, 16);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.quadIndex);
      gl.bindVertexArray(null);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, part.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, d.buf, gl.STATIC_DRAW);
    part.count = Math.min(d.count, MAX_QUADS * 4);
    return part;
  }

  disposeChunk(chunk) {
    for (let s = 0; s < 16; s++) {
      const m = chunk.meshes[s];
      if (!m) continue;
      for (const p of [m.o, m.t]) if (p) { this.gl.deleteBuffer(p.vbo); this.gl.deleteVertexArray(p.vao); }
      this.sections.delete(m);
      chunk.meshes[s] = null;
    }
  }

  // ---------------------------------------------------------------- frame
  // cam: {x,y,z,yaw,pitch,fov}, env: sky state + extras
  beginFrame(cam, env) {
    const gl = this.gl;
    this.resize();
    const aspect = this.width / this.height;
    const far = 2600; // the cloud layer extends far beyond the terrain
    perspective(this.proj, cam.fov || this.fov, aspect, 0.06, far);
    fpsView(this.view, 0, 0, 0, cam.yaw, cam.pitch);
    if (cam.roll) {
      // tilt for damage / glider banking
      const r = mat4(); const c = Math.cos(cam.roll), s = Math.sin(cam.roll);
      r[0] = c; r[1] = s; r[4] = -s; r[5] = c;
      multiply(this.view, r, this.view);
    }
    multiply(this.vp, this.proj, this.view);
    invert(this.inv, this.vp);
    frustumPlanes(this.planes, this.vp);
    this.cam = cam;
    this.env = env;
    gl.viewport(0, 0, this.width, this.height);
    gl.clearColor(env.fog[0], env.fog[1], env.fog[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  }

  setLightingUniforms(p, env) {
    p.f3v('u_skyColor', env.skyColor);
    p.f1('u_ambient', env.ambient);
    p.f3v('u_fogColor', env.fog);
    p.f1('u_fogNear', env.fogNear);
    p.f1('u_fogFar', env.fogFar);
    p.f1('u_time', env.time);
    p.f1('u_gamma', this.gamma);
  }

  drawSky() {
    const gl = this.gl, env = this.env;
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    const p = this.sky.use();
    p.m4('u_invVP', this.inv);
    p.f3v('u_sunDir', env.sun);
    p.f3v('u_zenith', env.zenith);
    p.f3v('u_horizon', env.horizon);
    p.f3v('u_sunGlow', env.sunGlow);
    p.f1('u_night', env.night);
    p.f1('u_time', env.time);
    p.f1('u_aurora', env.aurora || 0);
    p.f1('u_moonPhase', env.moonPhase || 0);
    p.f1('u_rain', env.rain || 0);
    p.f1('u_gamma', this.gamma);
    p.f1('u_underwater', env.underwater ? 1 : 0);
    p.f3v('u_fogColor', env.fog);
    gl.bindVertexArray(this.fsq);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.depthMask(true);
    gl.enable(gl.DEPTH_TEST);
  }

  drawTerrain(pass) {
    const gl = this.gl, env = this.env, cam = this.cam;
    const p = this.terrain.use();
    p.m4('u_vp', this.vp);
    this.setLightingUniforms(p, env);
    p.f3v('u_sunDir', env.sun);
    p.f1('u_daylight', env.daylight);
    p.i1('u_pass', pass);
    p.f1('u_underwater', env.underwater ? 1 : 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.blockTex);
    p.i1('u_tex', 0);
    const list = [];
    const maxD = (this.renderDist + 0.75) * 16;
    for (const m of this.sections) {
      const part = pass === 0 ? m.o : m.t;
      if (!part) continue;
      const x0 = m.cx * 16 - cam.x, y0 = m.sy * 16 - cam.y, z0 = m.cz * 16 - cam.z;
      const dx = x0 + 8, dz = z0 + 8;
      if (dx * dx + dz * dz > maxD * maxD) continue;
      if (!aabbInFrustum(this.planes, x0 - 0.5, y0 - 0.5, z0 - 0.5, x0 + 16.5, y0 + 16.5, z0 + 16.5)) continue;
      const dy = y0 + 8;
      list.push({ m, part, x0, y0, z0, d: dx * dx + dy * dy + dz * dz });
    }
    list.sort(pass === 0 ? (a, b) => a.d - b.d : (a, b) => b.d - a.d);
    if (pass === 1) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      gl.disable(gl.CULL_FACE);
    }
    let tris = 0;
    for (const it of list) {
      p.f3('u_origin', it.x0, it.y0, it.z0);
      p.f3('u_secWorld', ((it.m.cx * 16) % 4096 + 4096) % 4096, it.m.sy * 16, ((it.m.cz * 16) % 4096 + 4096) % 4096);
      gl.bindVertexArray(it.part.vao);
      gl.drawElements(gl.TRIANGLES, (it.part.count / 4) * 6, gl.UNSIGNED_INT, 0);
      tris += it.part.count / 2;
    }
    if (pass === 1) {
      gl.depthMask(true);
      gl.disable(gl.BLEND);
      gl.enable(gl.CULL_FACE);
    }
    gl.bindVertexArray(null);
    if (pass === 0) { this.stats.drawn = list.length; this.stats.tris = tris; } else this.stats.tris += tris;
    this.stats.sections = this.sections.size;
  }

  drawClouds() {
    const gl = this.gl, env = this.env, cam = this.cam;
    if (env.cloudCover >= 0.99) return;
    const p = this.cloud.use();
    p.m4('u_vp', this.vp);
    p.f3('u_cam', cam.x, cam.y, cam.z);
    p.f1('u_cloudY', 196);
    const ext = 1800;
    p.f1('u_extent', ext);
    p.f1('u_time', env.time);
    p.f1('u_cover', env.cloudCover);
    const dl = env.daylight;
    const lit = [0.25 + 0.75 * dl * env.skyColor[0], 0.27 + 0.73 * dl * env.skyColor[1], 0.33 + 0.67 * dl * env.skyColor[2]];
    const tw = env.twilight;
    lit[0] += tw * 0.25; lit[1] += tw * 0.08;
    p.f3v('u_cloudLit', lit.map((v) => Math.min(1, v * (1 - env.rain * 0.35))));
    p.f3v('u_cloudShade', lit.map((v) => v * 0.68));
    p.f3v('u_fogColor', env.fog);
    p.f1('u_gamma', this.gamma);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.noiseTex);
    p.i1('u_noise', 1);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.CULL_FACE);
    gl.depthMask(false);
    gl.bindVertexArray(this.fsq);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.depthMask(true);
    gl.enable(gl.CULL_FACE);
    gl.disable(gl.BLEND);
    gl.activeTexture(gl.TEXTURE0);
  }

  // lines: Float32Array of [x,y,z,r,g,b,a] per vertex, world space
  drawLines(verts, count, { depth = true, width = 1 } = {}) {
    const gl = this.gl, cam = this.cam;
    if (!count) return;
    const p = this.line.use();
    p.m4('u_vp', this.vp);
    p.f3('u_origin', -cam.x, -cam.y, -cam.z);
    gl.bindVertexArray(this.lineVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lineVBO);
    gl.bufferData(gl.ARRAY_BUFFER, verts.subarray(0, count * 7), gl.DYNAMIC_DRAW);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    if (!depth) gl.disable(gl.DEPTH_TEST);
    gl.lineWidth(width);
    gl.drawArrays(gl.LINES, 0, count);
    if (!depth) gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
  }

  // ---------------------------------------------------------------- generic meshes (entities, items)
  // verts: Float32Array with 13 floats per vertex: pos3 normal3 col4 uvl3 ; triangles
  createMesh(verts, indices) {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    const vbo = gl.createBuffer();
    const ibo = gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    const st = 13 * 4;
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, st, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, st, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, st, 24);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 3, gl.FLOAT, false, st, 40);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    return { vao, vbo, ibo, count: indices.length, type: indices instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT };
  }
  deleteMesh(m) { const gl = this.gl; gl.deleteBuffer(m.vbo); gl.deleteBuffer(m.ibo); gl.deleteVertexArray(m.vao); }

  beginEntities() {
    const gl = this.gl, env = this.env, cam = this.cam;
    const p = this.entity.use();
    p.m4('u_vp', this.vp);
    p.f3('u_origin', -cam.x, -cam.y, -cam.z);
    this.setLightingUniforms(p, env);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.blockTex);
    p.i1('u_tex', 0);
    p.f4('u_overlay', 0, 0, 0, 0);
    p.f1('u_emissive', 0);
    return p;
  }
  // light: [sky, r, g, b] 0..1
  drawMesh(mesh, model, light, overlay = null, emissive = 0, origin = null) {
    const gl = this.gl;
    const p = this.entity;
    p.m4('u_model', model);
    p.f4('u_light', light[0], light[1], light[2], light[3]);
    if (overlay) p.f4('u_overlay', overlay[0], overlay[1], overlay[2], overlay[3]); else p.f4('u_overlay', 0, 0, 0, 0);
    p.f1('u_emissive', emissive);
    if (origin) p.f3('u_origin', origin[0], origin[1], origin[2]);
    gl.bindVertexArray(mesh.vao);
    gl.drawElements(gl.TRIANGLES, mesh.count, mesh.type, 0);
  }

  // first-person item: own projection, cleared depth so it never clips into walls
  beginHand(fov) {
    const gl = this.gl;
    gl.clear(gl.DEPTH_BUFFER_BIT);
    const proj = mat4();
    perspective(proj, fov, this.width / this.height, 0.02, 10);
    const p = this.entity.use();
    p.m4('u_vp', proj);
    p.f3('u_origin', 0, 0, 0);
    this.setLightingUniforms(p, { ...this.env, fogNear: 1000, fogFar: 2000 });
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.blockTex);
    p.i1('u_tex', 0);
    return p;
  }

  // particles: list of {x,y,z (world), r,g,b,a, u0,v0,us,layer, size, em}
  drawParticles(list, count, additive = false) {
    if (!count) return;
    const gl = this.gl, cam = this.cam;
    if (this.partData.length < count * 14) this.partData = new Float32Array(count * 14 * 2);
    const d = this.partData;
    for (let i = 0; i < count; i++) {
      const q = list[i], o = i * 14;
      d[o] = q.x - cam.x; d[o + 1] = q.y - cam.y; d[o + 2] = q.z - cam.z;
      d[o + 3] = q.r; d[o + 4] = q.g; d[o + 5] = q.b; d[o + 6] = q.a;
      d[o + 7] = q.u0; d[o + 8] = q.v0; d[o + 9] = q.us; d[o + 10] = q.layer;
      d[o + 11] = q.size; d[o + 12] = q.em; d[o + 13] = 0;
    }
    const p = this.particle.use();
    p.m4('u_vp', this.vp);
    this.setLightingUniforms(p, this.env);
    const v = this.view;
    p.f3('u_right', v[0], v[4], v[8]);
    p.f3('u_up', v[1], v[5], v[9]);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.blockTex);
    p.i1('u_tex', 0);
    gl.bindVertexArray(this.partVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.partInst);
    gl.bufferData(gl.ARRAY_BUFFER, d.subarray(0, count * 14), gl.DYNAMIC_DRAW);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, additive ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, count);
    gl.enable(gl.CULL_FACE);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
  }

}

export { identity };
