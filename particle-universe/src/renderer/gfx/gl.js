// Minimal WebGL2 toolkit: programs with reflected uniform setters, textures and render targets.

export class GLError extends Error {}

function annotate(src, log) {
  const lines = src.split('\n');
  const m = /ERROR: \d+:(\d+)/.exec(log);
  if (!m) return log;
  const ln = Number(m[1]);
  const ctx = lines.slice(Math.max(0, ln - 4), ln + 2).map((l, i) => `${Math.max(1, ln - 3) + i}: ${l}`).join('\n');
  return `${log}\n---\n${ctx}`;
}

function compile(gl, type, src, name) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS) && !gl.isContextLost()) {
    const log = gl.getShaderInfoLog(sh) || '';
    gl.deleteShader(sh);
    throw new GLError(`[${name}] ${type === gl.VERTEX_SHADER ? 'vertex' : 'fragment'} shader:\n${annotate(src, log)}`);
  }
  return sh;
}

export class Program {
  constructor(gl, vs, fs, name = 'program') {
    this.gl = gl;
    this.name = name;
    const p = gl.createProgram();
    const v = compile(gl, gl.VERTEX_SHADER, vs, name);
    const f = compile(gl, gl.FRAGMENT_SHADER, fs, name);
    gl.attachShader(p, v);
    gl.attachShader(p, f);
    gl.linkProgram(p);
    gl.deleteShader(v);
    gl.deleteShader(f);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS) && !gl.isContextLost()) {
      throw new GLError(`[${name}] link: ${gl.getProgramInfoLog(p)}`);
    }
    this.handle = p;
    this.uniforms = new Map();
    const count = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    let unit = 0;
    for (let i = 0; i < count; i++) {
      const info = gl.getActiveUniform(p, i);
      const base = info.name.replace(/\[0\]$/, '');
      const loc = gl.getUniformLocation(p, info.name);
      const u = { loc, type: info.type, size: info.size, unit: -1 };
      if (info.type === gl.SAMPLER_2D || info.type === gl.INT_SAMPLER_2D || info.type === gl.UNSIGNED_INT_SAMPLER_2D) {
        u.unit = unit++;
      }
      this.uniforms.set(base, u);
    }
    gl.useProgram(p);
    for (const u of this.uniforms.values()) if (u.unit >= 0) gl.uniform1i(u.loc, u.unit);
  }

  use() { this.gl.useProgram(this.handle); return this; }

  has(name) { return this.uniforms.has(name); }

  set(name, value) {
    const u = this.uniforms.get(name);
    if (!u) return this;
    const gl = this.gl;
    switch (u.type) {
      case gl.FLOAT: if (u.size > 1) gl.uniform1fv(u.loc, value); else gl.uniform1f(u.loc, value); break;
      case gl.FLOAT_VEC2: gl.uniform2fv(u.loc, value); break;
      case gl.FLOAT_VEC3: gl.uniform3fv(u.loc, value); break;
      case gl.FLOAT_VEC4: gl.uniform4fv(u.loc, value); break;
      case gl.INT: case gl.BOOL: if (u.size > 1) gl.uniform1iv(u.loc, value); else gl.uniform1i(u.loc, value); break;
      case gl.INT_VEC2: gl.uniform2iv(u.loc, value); break;
      case gl.FLOAT_MAT4: gl.uniformMatrix4fv(u.loc, false, value); break;
      case gl.FLOAT_MAT3: gl.uniformMatrix3fv(u.loc, false, value); break;
      case gl.SAMPLER_2D: case gl.INT_SAMPLER_2D: case gl.UNSIGNED_INT_SAMPLER_2D:
        gl.activeTexture(gl.TEXTURE0 + u.unit);
        gl.bindTexture(gl.TEXTURE_2D, value && value.handle ? value.handle : value);
        break;
      default: throw new GLError(`uniform ${name}: unsupported type 0x${u.type.toString(16)}`);
    }
    return this;
  }

  setAll(obj) { for (const k in obj) this.set(k, obj[k]); return this; }

  dispose() { this.gl.deleteProgram(this.handle); }
}

export const FORMATS = {
  rgba32f: { internal: 'RGBA32F', format: 'RGBA', type: 'FLOAT', bpp: 16 },
  rgba16f: { internal: 'RGBA16F', format: 'RGBA', type: 'HALF_FLOAT', bpp: 8 },
  r16f: { internal: 'R16F', format: 'RED', type: 'HALF_FLOAT', bpp: 2 },
  r32f: { internal: 'R32F', format: 'RED', type: 'FLOAT', bpp: 4 },
  rgba8: { internal: 'RGBA8', format: 'RGBA', type: 'UNSIGNED_BYTE', bpp: 4 },
  r8: { internal: 'R8', format: 'RED', type: 'UNSIGNED_BYTE', bpp: 1 }
};

export class Texture {
  constructor(gl, w, h, fmt = 'rgba16f', { filter = 'LINEAR', wrap = 'CLAMP_TO_EDGE', data = null, srcType = null } = {}) {
    this.gl = gl;
    this.srcType = srcType;
    this.fmt = FORMATS[fmt];
    this.fmtName = fmt;
    this.filter = filter;
    this.wrap = wrap;
    this.handle = gl.createTexture();
    this.w = 0; this.h = 0;
    this.resize(w, h, data);
  }

  resize(w, h, data = null) {
    const gl = this.gl;
    this.w = w; this.h = h;
    gl.bindTexture(gl.TEXTURE_2D, this.handle);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl[this.filter]);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl[this.filter]);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl[this.wrap]);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl[this.wrap]);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl[this.fmt.internal], w, h, 0, gl[this.fmt.format], gl[this.srcType || this.fmt.type], data);
  }

  upload(data, w = this.w, h = this.h) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.handle);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, w, h, gl[this.fmt.format], gl[this.srcType || this.fmt.type], data);
  }

  get bytes() { return this.w * this.h * this.fmt.bpp; }

  dispose() { this.gl.deleteTexture(this.handle); }
}

// Framebuffer with N colour attachments (MRT).
export class Target {
  constructor(gl, textures) {
    this.gl = gl;
    this.textures = textures;
    this.fbo = gl.createFramebuffer();
    this.attach();
  }

  attach() {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    const bufs = [];
    this.textures.forEach((t, i) => {
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, t.handle, 0);
      bufs.push(gl.COLOR_ATTACHMENT0 + i);
    });
    gl.drawBuffers(bufs);
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (status !== gl.FRAMEBUFFER_COMPLETE && !gl.isContextLost()) throw new GLError('framebuffer incomplete: 0x' + status.toString(16));
  }

  get w() { return this.textures[0].w; }
  get h() { return this.textures[0].h; }

  bind() {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.viewport(0, 0, this.w, this.h);
    return this;
  }

  resize(w, h) {
    for (const t of this.textures) t.resize(w, h);
    this.attach();
  }

  dispose(withTextures = true) {
    this.gl.deleteFramebuffer(this.fbo);
    if (withTextures) for (const t of this.textures) t.dispose();
  }
}

export const FULLSCREEN_VS = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

export function createContext(canvas) {
  const gl = canvas.getContext('webgl2', {
    alpha: false, antialias: false, depth: false, stencil: false,
    premultipliedAlpha: false, preserveDrawingBuffer: false,
    powerPreference: 'high-performance', desynchronized: false
  });
  if (!gl) throw new GLError('WebGL2 不可用');
  const cbf = gl.getExtension('EXT_color_buffer_float');
  if (!cbf) throw new GLError('显卡不支持浮点渲染目标 (EXT_color_buffer_float)');
  gl.getExtension('EXT_float_blend');
  gl.getExtension('OES_texture_float_linear');
  return gl;
}

export function gpuName(gl) {
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const r = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  return String(r || 'Unknown GPU');
}

// Simplify "ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0 ps_5_0, D3D11)" → "NVIDIA GeForce RTX 3070"
export function prettyGpuName(raw) {
  let s = raw;
  const m = /ANGLE \(([^,]+),\s*([^,]+?)(?:\s+Direct3D|\s+\(0x|,|\))/.exec(raw);
  if (m) s = m[2];
  return s.replace(/\s*\(0x[0-9a-f]+\)/i, '').replace(/\s+/g, ' ').trim();
}
