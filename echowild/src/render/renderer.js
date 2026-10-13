// WebGL2 renderer. A frame:
//   shadow map (sun / moon) → HDR scene: sky (from an atmosphere LUT), opaque terrain, entities,
//   volumetric clouds (half res), translucent terrain with water refraction / reflections,
//   particles, overlays → post: bloom, light shafts, ACES tonemap + grade, FXAA → screen.
// Everything is drawn camera-relative. On the lowest quality (or without float render targets)
// the scene is drawn straight to the screen and shaders tonemap inline.

import { Program, createTextureArray, createTexture2D } from './gl.js';
import * as SH from './shaders.js';
import { buildBlockTextures, buildMips, buildMaterialMaps, buildMatMips } from './textures.js';
import { VERTEX_BYTES } from './mesher.js';
import { mat4, perspective, multiply, invert, fpsView, frustumPlanes, aabbInFrustum, identity } from '../core/math.js';
import { tileNoise } from '../core/noise.js';
import { SUN_INTENSITY, MOON_INTENSITY } from './atmosphere.js';

const MAX_QUADS = 131072;
const NEAR = 0.06, FAR = 2600;
const LUT_W = 128, LUT_H = 64;

// texture units shared by every program
const UNIT = { u_mat: 9, u_tex: 0, u_skyLUT: 1, u_shadowMap: 2, u_sceneColor: 3, u_sceneDepth: 4, u_noise2: 5, u_noise3: 6, u_depth: 4, u_src: 3, u_scene: 3, u_bloom: 7, u_rays: 8, u_clouds: 3, u_noise: 5 };

export const QUALITY = {
  low: { label: '低', pbr: false, post: false, shadow: 0, shadowRange: 0, clouds: 0, ssr: 0, godrays: false, bloom: false, fxaa: false },
  medium: { label: '中', pbr: true, post: true, shadow: 1024, shadowRange: 44, clouds: 10, ssr: 0, godrays: false, bloom: true, fxaa: true },
  high: { label: '高', pbr: true, post: true, shadow: 2048, shadowRange: 64, clouds: 16, ssr: 22, godrays: true, bloom: true, fxaa: true },
  ultra: { label: '极致', pbr: true, post: true, shadow: 4096, shadowRange: 96, clouds: 26, ssr: 40, godrays: true, bloom: true, fxaa: true },
};

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
    this.proj = mat4(); this.view = mat4(); this.vp = mat4(); this.inv = mat4();
    this.shadowVP = mat4();
    this.planes = new Float32Array(24);
    this.sections = new Set();
    this.stats = { sections: 0, drawn: 0, tris: 0, shadowDrawn: 0 };
    this.floatTargets = !!gl.getExtension('EXT_color_buffer_float');
    gl.getExtension('OES_texture_float_linear');
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    this.gpu = String(dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    this.softwareGL = /SwiftShader|llvmpipe|Software|Basic Render/i.test(this.gpu);

    const prog = (vs, fs, name) => {
      const p = new Program(gl, vs, fs, name);
      p.use();
      for (const [n, u] of Object.entries(UNIT)) p.i1(n, u);
      return p;
    };
    this.terrain = prog(SH.TERRAIN_VS, SH.TERRAIN_FS, 'terrain');
    this.trans = prog(SH.TERRAIN_VS, SH.TRANS_FS, 'translucent');
    this.shadowProg = prog(SH.SHADOW_VS, SH.SHADOW_FS, 'shadow');
    this.shadowEnt = prog(SH.SHADOW_ENTITY_VS, SH.SHADOW_ENTITY_FS, 'shadowEntity');
    this.sky = prog(SH.SKYQ_VS, SH.SKY_FS, 'sky');
    this.skyLut = prog(SH.FSQ_VS, SH.SKYLUT_FS, 'skyLUT');
    this.cloud = prog(SH.FSQ_VS, SH.CLOUD_FS, 'clouds');
    this.cloudLow = prog(SH.SKYQ_VS, SH.CLOUD_FS, 'cloudsLow');
    this.cloudMix = prog(SH.FSQ_VS, SH.CLOUDMIX_FS, 'cloudMix');
    this.line = prog(SH.LINE_VS, SH.LINE_FS, 'line');
    this.entity = prog(SH.ENTITY_VS, SH.ENTITY_FS, 'entity');
    this.particle = prog(SH.PARTICLE_VS, SH.PARTICLE_FS, 'particle');
    this.bloomPre = prog(SH.FSQ_VS, SH.BLOOM_PRE_FS, 'bloomPre');
    this.bloomDown = prog(SH.FSQ_VS, SH.BLOOM_DOWN_FS, 'bloomDown');
    this.bloomUp = prog(SH.FSQ_VS, SH.BLOOM_UP_FS, 'bloomUp');
    this.godrays = prog(SH.FSQ_VS, SH.GODRAYS_FS, 'godrays');
    this.composite = prog(SH.FSQ_VS, SH.COMPOSITE_FS, 'composite');
    this.fxaa = prog(SH.FSQ_VS, SH.FXAA_FS, 'fxaa');
    this.copy = prog(SH.FSQ_VS, SH.COPY_FS, 'copy');

    // block textures
    const tex = buildBlockTextures();
    this.texInfo = tex;
    const mips = buildMips(tex.data, tex.layers, tex.size);
    this.blockTex = createTextureArray(gl, tex.size, tex.layers, mips);
    const mat = buildMaterialMaps(tex);
    this.matTex = createTextureArray(gl, mat.size, mat.layers, buildMatMips(mat.data, mat.layers, mat.size));

    // shared quad index buffer
    const idx = new Uint32Array(MAX_QUADS * 6);
    for (let q = 0; q < MAX_QUADS; q++) {
      const v = q * 4, i = q * 6;
      idx[i] = v; idx[i + 1] = v + 1; idx[i + 2] = v + 2; idx[i + 3] = v; idx[i + 4] = v + 2; idx[i + 5] = v + 3;
    }
    this.quadIndex = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.quadIndex);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);

    this.fsq = this.makeQuadVAO([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]);

    // 2D noise (water normals, foam) and 3D noise (clouds)
    const N = 256, nz = tileNoise(9137, 16), nz2 = tileNoise(5521, 32);
    const nd = new Uint8Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const v = nz(x / 16, y / 16) * 0.7 + nz2(x / 8, y / 8) * 0.3;
      nd[y * N + x] = Math.max(0, Math.min(255, v * 255));
    }
    this.noiseTex = createTexture2D(gl, N, N, nd, { format: 'r8', filter: 'linear', wrap: 'repeat', mip: true });
    this.noise3 = makeNoise3D(gl, 48);

    // sky LUT
    this.lutFormat = this.floatTargets ? 'rgba16f' : 'rgba8';
    this.lutScale = this.floatTargets ? 1 : 0.25;
    this.lut = this.makeTarget(LUT_W, LUT_H, { color: this.lutFormat, filter: 'linear', clamp: true });

    // a 1×1 depth texture stands in for the shadow map when shadows are off
    this.dummyShadow = this.makeDepthTexture(1, 1, true);

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
    this.targets = null;
    this.setQuality(this.softwareGL ? 'low' : 'high');
    this.resize();
  }

  // ---------------------------------------------------------------- quality / targets
  setQuality(name) {
    const q = QUALITY[name] || QUALITY.high;
    this.qualityName = QUALITY[name] ? name : 'high';
    this.q = { ...q, post: q.post && this.floatTargets };
    if (!this.q.post) this.q = { ...this.q, clouds: 0, ssr: 0, godrays: false, bloom: false, fxaa: false };
    // (re)build the shadow map at the new size
    const gl = this.gl;
    if (this.shadow) { gl.deleteFramebuffer(this.shadow.fbo); gl.deleteTexture(this.shadow.tex); this.shadow = null; }
    if (this.q.shadow) {
      const tex = this.makeDepthTexture(this.q.shadow, this.q.shadow, true);
      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, tex, 0);
      gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      this.shadow = { tex, fbo, size: this.q.shadow };
    }
    this.disposeTargets();
  }

  makeDepthTexture(w, h, compare) {
    const gl = this.gl;
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, w, h);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, compare ? gl.LINEAR : gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, compare ? gl.LINEAR : gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (compare) {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    }
    if (w === 1 && h === 1 && compare) {
      // a cleared 1×1 depth target reads as "lit" everywhere
      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, t, 0);
      gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE);
      gl.clearDepth(1); gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.deleteFramebuffer(fbo);
    }
    return t;
  }

  // color: 'rgba16f' | 'rgba8' | null ; depth: true → a depth texture attachment
  makeTarget(w, h, { color = 'rgba8', depth = false, filter = 'linear', clamp = true } = {}) {
    const gl = this.gl;
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    let tex = null, dtex = null;
    if (color) {
      tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texStorage2D(gl.TEXTURE_2D, 1, color === 'rgba16f' ? gl.RGBA16F : gl.RGBA8, w, h);
      const f = filter === 'linear' ? gl.LINEAR : gl.NEAREST;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, clamp ? gl.CLAMP_TO_EDGE : gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    } else { gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE); }
    if (depth) {
      dtex = this.makeDepthTexture(w, h, false);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, dtex, 0);
    }
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (!ok) throw new Error(`framebuffer ${w}×${h} ${color} incomplete`);
    return { fbo, tex, dtex, w, h };
  }
  freeTarget(t) {
    if (!t) return;
    const gl = this.gl;
    gl.deleteFramebuffer(t.fbo);
    if (t.tex) gl.deleteTexture(t.tex);
    if (t.dtex) gl.deleteTexture(t.dtex);
  }
  disposeTargets() {
    if (!this.targets) return;
    const T = this.targets;
    for (const k of ['scene', 'copy', 'clouds', 'ldr', 'rays']) this.freeTarget(T[k]);
    for (const b of T.bloom || []) this.freeTarget(b);
    this.targets = null;
  }
  ensureTargets() {
    if (!this.q.post) { this.disposeTargets(); return null; }
    const w = this.width, h = this.height;
    if (this.targets && this.targets.w === w && this.targets.h === h) return this.targets;
    this.disposeTargets();
    const T = { w, h };
    T.scene = this.makeTarget(w, h, { color: 'rgba16f', depth: true });
    T.copy = this.makeTarget(w, h, { color: 'rgba16f', depth: true });
    T.clouds = this.makeTarget(Math.max(1, w >> 1), Math.max(1, h >> 1), { color: 'rgba16f' });
    T.ldr = this.makeTarget(w, h, { color: 'rgba8' });
    T.rays = this.makeTarget(Math.max(1, w >> 1), Math.max(1, h >> 1), { color: 'rgba8' });
    T.bloom = [];
    let bw = w >> 1, bh = h >> 1;
    for (let i = 0; i < 6 && bw >= 4 && bh >= 4; i++) { T.bloom.push(this.makeTarget(bw, bh, { color: 'rgba16f' })); bw >>= 1; bh >>= 1; }
    this.targets = T;
    return T;
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
    let m = chunk.meshes[sy];
    // lowest surface in the chunk: sections wholly below it are buried and cast no useful shadow
    if (chunk.heights) { let lo = 255; for (let i = 0; i < 256; i++) if (chunk.heights[i] < lo) lo = chunk.heights[i]; chunk.minH = lo; }
    if (!m) {
      m = { cx: chunk.cx, cz: chunk.cz, sy, o: null, t: null, chunk };
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

  // forget every chunk mesh (the renderer outlives a world: it is shared by the title scene and games)
  resetWorld() {
    const gl = this.gl;
    for (const m of this.sections) for (const p of [m.o, m.t]) if (p) { gl.deleteBuffer(p.vbo); gl.deleteVertexArray(p.vao); }
    this.sections.clear();
    this.lutKey = null;
    this.stats.sections = this.stats.drawn = this.stats.tris = 0;
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
  // cam: {x,y,z,yaw,pitch,fov,roll}; env: lighting state (see Game.envState);
  // shadowCasters(r): draws entities into the shadow map
  beginFrame(cam, env, shadowCasters) {
    const gl = this.gl;
    this.resize();
    const aspect = this.width / this.height;
    perspective(this.proj, cam.fov || this.fov, aspect, NEAR, FAR);
    fpsView(this.view, 0, 0, 0, cam.yaw, cam.pitch);
    if (cam.roll) {
      const r = mat4(); const c = Math.cos(cam.roll), s = Math.sin(cam.roll);
      r[0] = c; r[1] = s; r[4] = -s; r[5] = c;
      multiply(this.view, r, this.view);
    }
    multiply(this.vp, this.proj, this.view);
    invert(this.inv, this.vp);
    frustumPlanes(this.planes, this.vp);
    this.cam = cam;
    this.env = env;
    this.direct = !this.q.post;
    // sky LUT for this frame's sun
    this.updateSkyLUT();
    // shadow map
    this.shadowOn = false;
    if (this.shadow && env.lightCol && Math.max(...env.lightCol) > 0.02) this.renderShadowMap(shadowCasters);
    // scene target
    const T = this.ensureTargets();
    gl.bindFramebuffer(gl.FRAMEBUFFER, T ? T.scene.fbo : null);
    gl.viewport(0, 0, this.width, this.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clearDepth(1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  }

  updateSkyLUT() {
    const gl = this.gl, env = this.env;
    const key = `${env.sun[0].toFixed(3)},${env.sun[1].toFixed(3)},${(env.rain || 0).toFixed(2)}`;
    if (key === this.lutKey) return;
    this.lutKey = key;
    const p = this.skyLut.use();
    p.f3v('u_sun', env.sun);
    p.f1('u_rain', env.rain || 0);
    p.f1('u_sunI', SUN_INTENSITY * this.lutScale);
    p.f1('u_moonI', MOON_INTENSITY * this.lutScale);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.lut.fbo);
    gl.viewport(0, 0, LUT_W, LUT_H);
    gl.disable(gl.DEPTH_TEST);
    gl.bindVertexArray(this.fsq);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.enable(gl.DEPTH_TEST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  // light-space matrix: an orthographic box around the camera, snapped to shadow texels
  computeShadowMatrix() {
    const env = this.env, cam = this.cam, L = env.lightDir;
    const R = this.q.shadowRange, D = R + 180;
    const f = [-L[0], -L[1], -L[2]];
    let up = Math.abs(f[1]) > 0.99 ? [0, 0, 1] : [0, 1, 0];
    const cr = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const nrm = (a) => { const l = Math.hypot(...a); return a.map((v) => v / l); };
    const r = nrm(cr(f, up));
    const u = cr(r, f);
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const c = [cam.x, cam.y, cam.z];
    const texel = (2 * R) / this.shadow.size;
    const cx = Math.round(dot(c, r) / texel) * texel, cy = Math.round(dot(c, u) / texel) * texel, cz = dot(c, f);
    const m = this.shadowVP;
    m[0] = r[0] / R; m[4] = r[1] / R; m[8] = r[2] / R; m[12] = (dot(c, r) - cx) / R;
    m[1] = u[0] / R; m[5] = u[1] / R; m[9] = u[2] / R; m[13] = (dot(c, u) - cy) / R;
    m[2] = f[0] / D; m[6] = f[1] / D; m[10] = f[2] / D; m[14] = (dot(c, f) - cz) / D;
    m[3] = 0; m[7] = 0; m[11] = 0; m[15] = 1;
    this.shadowAxes = { r, u, f, R, D, ox: m[12], oy: m[13], oz: m[14] };
    this.shadowOffset = texel * 1.6;
  }

  renderShadowMap(shadowCasters) {
    const gl = this.gl, cam = this.cam, env = this.env;
    this.computeShadowMatrix();
    const A = this.shadowAxes;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadow.fbo);
    gl.viewport(0, 0, this.shadow.size, this.shadow.size);
    gl.clearDepth(1);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(1.6, 2.0);
    gl.disable(gl.CULL_FACE);
    const p = this.shadowProg.use();
    p.m4('u_vp', this.shadowVP);
    p.f1('u_time', env.time);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.blockTex);
    let drawn = 0;
    const lim = 1 + 14 / A.R, limZ = 1 + 14 / A.D;
    for (const m of this.sections) {
      if (!m.o) continue;
      if (m.chunk && m.sy * 16 + 16 < (m.chunk.minH ?? 0) - 3) continue;
      const x0 = m.cx * 16 - cam.x, y0 = m.sy * 16 - cam.y, z0 = m.cz * 16 - cam.z;
      const sx = x0 + 8, sy = y0 + 8, sz = z0 + 8;
      const lx = (sx * A.r[0] + sy * A.r[1] + sz * A.r[2]) / A.R + A.ox;
      const ly = (sx * A.u[0] + sy * A.u[1] + sz * A.u[2]) / A.R + A.oy;
      const lz = (sx * A.f[0] + sy * A.f[1] + sz * A.f[2]) / A.D + A.oz;
      if (Math.abs(lx) > lim || Math.abs(ly) > lim || Math.abs(lz) > limZ) continue;
      p.f3('u_origin', x0, y0, z0);
      p.f3('u_secWorld', ((m.cx * 16) % 4096 + 4096) % 4096, m.sy * 16, ((m.cz * 16) % 4096 + 4096) % 4096);
      gl.bindVertexArray(m.o.vao);
      gl.drawElements(gl.TRIANGLES, (m.o.count / 4) * 6, gl.UNSIGNED_INT, 0);
      drawn++;
    }
    this.stats.shadowDrawn = drawn;
    if (shadowCasters) {
      this.shadowMode = true;
      shadowCasters(this);
      this.shadowMode = false;
    }
    gl.disable(gl.POLYGON_OFFSET_FILL);
    gl.enable(gl.CULL_FACE);
    gl.bindVertexArray(null);
    this.shadowOn = true;
  }

  // lighting uniforms shared by every lit program
  setLightingUniforms(p, env, { shadows = true } = {}) {
    const gl = this.gl;
    p.f3v('u_lightDir', env.lightDir);
    p.f3v('u_lightCol', env.lightCol);
    p.f3v('u_ambient', env.ambient);
    p.f3v('u_ambientMin', env.ambientMin);
    p.f3v('u_fogColor', env.fogLinear);
    p.f1('u_fogNear', env.fogNear);
    p.f1('u_fogFar', env.fogFar);
    p.f1('u_haze', env.haze);
    p.f1('u_caveFog', env.caveFog || 0);
    p.f1('u_time', env.time);
    p.f1('u_exposure', env.exposure);
    p.f1('u_direct', this.direct ? 1 : 0);
    p.f1('u_underwater', env.underwater ? 1 : 0);
    p.f3v('u_lutSun', env.sun);
    p.f1('u_lutScale', this.lutScale);
    p.f3v('u_hazeSun', env.hazeSun);
    p.f3v('u_hazeAnti', env.hazeAnti);
    const on = shadows && this.shadowOn;
    p.f1('u_shadowOn', on ? 1 : 0);
    p.f1('u_shadowTexel', on ? 1 / this.shadow.size : 0);
    p.m4('u_shadowVP', this.shadowVP);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.lut.tex);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, on ? this.shadow.tex : this.dummyShadow);
    gl.activeTexture(gl.TEXTURE0);
  }

  // call after the opaque terrain: the far-plane quad only shades pixels nothing covered
  drawSky() {
    const gl = this.gl, env = this.env;
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(false);
    const p = this.sky.use();
    this.setLightingUniforms(p, env, { shadows: false });
    p.m4('u_invVP', this.inv);
    p.f3v('u_sunDir', env.sun);
    p.f3v('u_sunDisc', env.sunDisc);
    p.f3v('u_moonDisc', env.moonDisc);
    p.f1('u_night', env.night);
    p.f1('u_aurora', env.aurora || 0);
    p.f1('u_moonPhase', env.moonPhase || 0);
    p.f1('u_rain', env.rain || 0);
    gl.bindVertexArray(this.fsq);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    if (this.direct && this.env.cloudCover < 0.99) {
      // no depth target to march against: draw a light cloud layer behind everything
      const c = this.cloudLow.use();
      this.setLightingUniforms(c, env, { shadows: false });
      c.m4('u_invVP', this.inv);
      c.f3('u_cam', this.cam.x, this.cam.y, this.cam.z);
      c.f1('u_cover', env.cloudCover);
      c.f1('u_steps', 2);
      c.f1('u_lo', 182); c.f1('u_hi', 236);
      c.f1('u_noDepth', 1);
      gl.activeTexture(gl.TEXTURE6); gl.bindTexture(gl.TEXTURE_3D, this.noise3);
      gl.activeTexture(gl.TEXTURE0);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.disable(gl.BLEND);
    }
    gl.depthMask(true);
    gl.depthFunc(gl.LESS);
  }

  drawTerrain(pass) {
    const gl = this.gl, env = this.env, cam = this.cam;
    const T = this.targets;
    if (pass === 1) this.prepareTranslucent();
    const p = (pass === 0 ? this.terrain : this.trans).use();
    p.m4('u_vp', this.vp);
    this.setLightingUniforms(p, env);
    p.f1('u_shadowOff', this.shadowOffset || 0);
    if (pass === 0) {
      p.f1('u_pbr', this.q.pbr ? 1 : 0);
      p.f1('u_wet', env.wet || 0);
      gl.activeTexture(gl.TEXTURE9); gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.matTex);
      gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, this.noiseTex);
    }
    if (pass === 1) {
      p.f2('u_screen', this.width, this.height);
      p.f1('u_near', NEAR); p.f1('u_far', FAR);
      p.f1('u_refract', T ? 1 : 0);
      p.f1('u_ssr', T ? this.q.ssr : 0);
      gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, T ? T.copy.tex : null);
      gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, T ? T.copy.dtex : null);
      gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, this.noiseTex);
    }
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.blockTex);
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

  // copy the opaque scene (colour + depth) so translucent surfaces can sample it
  snapshotScene() {
    const gl = this.gl, T = this.targets;
    if (!T) return;
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, T.scene.fbo);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, T.copy.fbo);
    gl.blitFramebuffer(0, 0, T.w, T.h, 0, 0, T.w, T.h, gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, T.scene.fbo);
  }

  // volumetric clouds, ray-marched at half resolution against the opaque depth
  drawClouds() {
    const gl = this.gl, env = this.env, cam = this.cam, T = this.targets;
    if (!T || !this.q.clouds || (env.caveFog || 0) > 0.95 || env.underwater) return;
    this.snapshotScene();
    const p = this.cloud.use();
    this.setLightingUniforms(p, env, { shadows: false });
    p.m4('u_invVP', this.inv);
    p.f3('u_cam', cam.x, cam.y, cam.z);
    p.f1('u_cover', env.cloudCover);
    p.f1('u_steps', this.q.clouds);
    p.f1('u_lo', 182); p.f1('u_hi', 236);
    p.f1('u_noDepth', 0);
    gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, T.copy.dtex);
    gl.activeTexture(gl.TEXTURE6); gl.bindTexture(gl.TEXTURE_3D, this.noise3);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, T.clouds.fbo);
    gl.viewport(0, 0, T.clouds.w, T.clouds.h);
    gl.disable(gl.DEPTH_TEST);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindVertexArray(this.fsq);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    // composite (premultiplied) over the scene
    gl.bindFramebuffer(gl.FRAMEBUFFER, T.scene.fbo);
    gl.viewport(0, 0, T.w, T.h);
    const m = this.cloudMix.use();
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, T.clouds.tex);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.enable(gl.DEPTH_TEST);
    gl.activeTexture(gl.TEXTURE0);
    void m;
  }

  prepareTranslucent() { this.snapshotScene(); }

  // lines: Float32Array of [x,y,z,r,g,b,a] per vertex, world space
  drawLines(verts, count, { depth = true, width = 1, scale = 1.4 } = {}) {
    const gl = this.gl, cam = this.cam;
    if (!count || this.shadowMode) return;
    const p = this.line.use();
    p.m4('u_vp', this.vp);
    p.f3('u_origin', -cam.x, -cam.y, -cam.z);
    p.f1('u_direct', this.direct ? 1 : 0);
    p.f1('u_lineScale', scale / Math.max(0.2, this.env.exposure));
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
    if (this.shadowMode) {
      const p = this.shadowEnt.use();
      p.m4('u_vp', this.shadowVP);
      p.f3('u_origin', -cam.x, -cam.y, -cam.z);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.blockTex);
      return p;
    }
    const p = this.entity.use();
    p.m4('u_vp', this.vp);
    p.f3('u_origin', -cam.x, -cam.y, -cam.z);
    this.setLightingUniforms(p, env);
    p.f1('u_noFog', 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.blockTex);
    p.f4('u_overlay', 0, 0, 0, 0);
    p.f1('u_emissive', 0);
    return p;
  }
  setGlowMask(v) { if (!this.shadowMode) this.entity.f1('u_glowMask', v); }
  // light: [sky, r, g, b] 0..1
  drawMesh(mesh, model, light, overlay = null, emissive = 0, origin = null) {
    const gl = this.gl;
    if (this.shadowMode) {
      const p = this.shadowEnt;
      p.m4('u_model', model);
      if (origin) p.f3('u_origin', origin[0], origin[1], origin[2]);
      gl.bindVertexArray(mesh.vao);
      gl.drawElements(gl.TRIANGLES, mesh.count, mesh.type, 0);
      return;
    }
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
    this.setLightingUniforms(p, this.env, { shadows: false });
    p.f1('u_noFog', 1);
    // the hand is lit by the sun only if the player stands in it
    p.f3v('u_lightCol', this.env.lightCol.map((c) => c * (this.env.handSun ?? 1)));
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.blockTex);
    return p;
  }

  // particles: list of {x,y,z (world), r,g,b,a, u0,v0,us,layer, size, em}
  drawParticles(list, count, additive = false) {
    if (!count || this.shadowMode) return;
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
    this.setLightingUniforms(p, this.env, { shadows: false });
    p.f1('u_partScale', this.env.partScale || 1);
    const v = this.view;
    p.f3('u_right', v[0], v[4], v[8]);
    p.f3('u_up', v[1], v[5], v[9]);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.blockTex);
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

  // ---------------------------------------------------------------- post processing
  endFrame() {
    const gl = this.gl, T = this.targets, env = this.env;
    if (!T) return;
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(this.fsq);
    const full = () => gl.drawArrays(gl.TRIANGLES, 0, 6);
    // bloom
    const B = T.bloom;
    if (this.q.bloom && B.length) {
      let p = this.bloomPre.use();
      gl.bindFramebuffer(gl.FRAMEBUFFER, B[0].fbo); gl.viewport(0, 0, B[0].w, B[0].h);
      gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, T.scene.tex);
      p.f2('u_texel', 1 / T.w, 1 / T.h); p.f1('u_threshold', 1.1 / Math.max(0.05, env.exposure));
      full();
      p = this.bloomDown.use();
      for (let i = 1; i < B.length; i++) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, B[i].fbo); gl.viewport(0, 0, B[i].w, B[i].h);
        gl.bindTexture(gl.TEXTURE_2D, B[i - 1].tex);
        p.f2('u_texel', 1 / B[i - 1].w, 1 / B[i - 1].h);
        full();
      }
      p = this.bloomUp.use();
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      for (let i = B.length - 1; i > 0; i--) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, B[i - 1].fbo); gl.viewport(0, 0, B[i - 1].w, B[i - 1].h);
        gl.bindTexture(gl.TEXTURE_2D, B[i].tex);
        p.f2('u_texel', 1 / B[i].w, 1 / B[i].h); p.f1('u_radius', 1);
        full();
      }
      gl.disable(gl.BLEND);
    }
    // light shafts toward the sun (or moon)
    let rays = 0;
    const L = env.lightDir, v = this.vp;
    const cx = v[0] * L[0] + v[4] * L[1] + v[8] * L[2], cy = v[1] * L[0] + v[5] * L[1] + v[9] * L[2], cw = v[3] * L[0] + v[7] * L[1] + v[11] * L[2];
    if (cw > 0.05) {
      const sx = cx / cw * 0.5 + 0.5, sy = cy / cw * 0.5 + 0.5;
      const edge = Math.max(0, 1 - Math.max(0, Math.max(Math.abs(sx - 0.5), Math.abs(sy - 0.5)) - 0.5) / 0.6);
      const k = edge * Math.min(1, Math.max(0, L[1] * 6)) * (1 - (env.rain || 0)) * (env.underwater ? 0 : 1);
      env.sunScreen = k > 0.01 ? [sx, sy, k] : null;
    } else env.sunScreen = null;
    if (this.q.godrays && env.sunScreen) {
      const p = this.godrays.use();
      gl.bindFramebuffer(gl.FRAMEBUFFER, T.rays.fbo); gl.viewport(0, 0, T.rays.w, T.rays.h);
      gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, T.scene.tex);
      gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, T.copy.dtex);
      p.f2('u_sunUV', env.sunScreen[0], env.sunScreen[1]);
      p.f1('u_strength', env.sunScreen[2]);
      full();
      rays = 1;
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, T.rays.fbo); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    }
    // tonemap + grade
    const p = this.composite.use();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.q.fxaa ? T.ldr.fbo : null);
    gl.viewport(0, 0, T.w, T.h);
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, T.scene.tex);
    gl.activeTexture(gl.TEXTURE7); gl.bindTexture(gl.TEXTURE_2D, this.q.bloom && B.length ? B[0].tex : null);
    gl.activeTexture(gl.TEXTURE8); gl.bindTexture(gl.TEXTURE_2D, T.rays.tex);
    p.f1('u_bloomK', this.q.bloom ? 0.055 : 0);
    p.f3v('u_rayColor', rays ? env.lightCol.map((c) => c * 0.35) : [0, 0, 0]);
    p.f1('u_exposure', env.exposure);
    p.f1('u_underwater', env.underwater && !env.inLava ? 1 : 0);
    p.f3v('u_waterTint', env.waterTint || [1, 1, 1]);
    p.f1('u_time', env.time);
    p.f1('u_hurt', env.hurt || 0);
    p.f1('u_saturation', env.saturation ?? 1.02);
    p.f1('u_contrast', env.contrast ?? 0.12);
    full();
    if (this.q.fxaa) {
      const f = this.fxaa.use();
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, T.ldr.tex);
      f.f2('u_texel', 1 / T.w, 1 / T.h);
      full();
    }
    gl.activeTexture(gl.TEXTURE0);
    gl.bindVertexArray(null);
    gl.enable(gl.DEPTH_TEST);
  }
}

// tileable 3D value-Worley noise for the clouds (R8, size³)
function makeNoise3D(gl, n) {
  const data = new Uint8Array(n * n * n);
  const h = (x, y, z, s) => {
    let k = (x * 374761393 + y * 668265263 + z * 2147483647 + s * 1274126177) | 0;
    k = Math.imul(k ^ (k >>> 13), 1274126177);
    return ((k ^ (k >>> 16)) >>> 0) / 4294967296;
  };
  const value = (x, y, z, p, s) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const fx = x - xi, fy = y - yi, fz = z - zi;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
    const g = (a, b, c) => h(((xi + a) % p + p) % p, ((yi + b) % p + p) % p, ((zi + c) % p + p) % p, s);
    const x00 = g(0, 0, 0) + (g(1, 0, 0) - g(0, 0, 0)) * u, x10 = g(0, 1, 0) + (g(1, 1, 0) - g(0, 1, 0)) * u;
    const x01 = g(0, 0, 1) + (g(1, 0, 1) - g(0, 0, 1)) * u, x11 = g(0, 1, 1) + (g(1, 1, 1) - g(0, 1, 1)) * u;
    return (x00 + (x10 - x00) * v) + ((x01 + (x11 - x01) * v) - (x00 + (x10 - x00) * v)) * w;
  };
  const worley = (x, y, z, p, s) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    let best = 9;
    for (let c = -1; c <= 1; c++) for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) {
      const cx = xi + a, cy = yi + b, cz = zi + c;
      const wx = ((cx % p) + p) % p, wy = ((cy % p) + p) % p, wz = ((cz % p) + p) % p;
      const px = cx + h(wx, wy, wz, s), py = cy + h(wx, wy, wz, s + 7), pz = cz + h(wx, wy, wz, s + 13);
      const d = (px - x) ** 2 + (py - y) ** 2 + (pz - z) ** 2;
      if (d < best) best = d;
    }
    return 1 - Math.min(1, Math.sqrt(best));
  };
  for (let z = 0; z < n; z++) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const fx = x / n, fy = y / n, fz = z / n;
    const pv = value(fx * 4, fy * 4, fz * 4, 4, 1) * 0.5 + value(fx * 8, fy * 8, fz * 8, 8, 2) * 0.3 + value(fx * 16, fy * 16, fz * 16, 16, 3) * 0.2;
    const wv = worley(fx * 4, fy * 4, fz * 4, 4, 5) * 0.6 + worley(fx * 8, fy * 8, fz * 8, 8, 6) * 0.4;
    const v = pv * 0.55 + wv * 0.55 - 0.08; // billowy: value noise eroded by cells
    data[(z * n + y) * n + x] = Math.max(0, Math.min(255, v * 255));
  }
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_3D, t);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage3D(gl.TEXTURE_3D, 0, gl.R8, n, n, n, 0, gl.RED, gl.UNSIGNED_BYTE, data);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  for (const k of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T, gl.TEXTURE_WRAP_R]) gl.texParameteri(gl.TEXTURE_3D, k, gl.REPEAT);
  gl.generateMipmap(gl.TEXTURE_3D);
  return t;
}

export { identity };
