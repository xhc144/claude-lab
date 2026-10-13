// Thin WebGL2 helpers.

export function compile(gl, type, src, name) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    const lines = src.split('\n').map((l, i) => `${String(i + 1).padStart(3)} ${l}`).join('\n');
    throw new Error(`shader ${name} failed:\n${log}\n${lines}`);
  }
  return s;
}

export class Program {
  constructor(gl, vs, fs, name = 'program') {
    this.gl = gl;
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs, name + '.vs'));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs, name + '.fs'));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`link ${name}: ${gl.getProgramInfoLog(p)}`);
    this.p = p;
    this.u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i);
      const nm = info.name.replace(/\[0\]$/, '');
      this.u[nm] = gl.getUniformLocation(p, info.name);
    }
  }
  use() { this.gl.useProgram(this.p); return this; }
  f1(n, v) { const l = this.u[n]; if (l) this.gl.uniform1f(l, v); return this; }
  i1(n, v) { const l = this.u[n]; if (l) this.gl.uniform1i(l, v); return this; }
  f2(n, a, b) { const l = this.u[n]; if (l) this.gl.uniform2f(l, a, b); return this; }
  f3(n, a, b, c) { const l = this.u[n]; if (l) this.gl.uniform3f(l, a, b, c); return this; }
  f3v(n, v) { const l = this.u[n]; if (l) this.gl.uniform3fv(l, v); return this; }
  f4(n, a, b, c, d) { const l = this.u[n]; if (l) this.gl.uniform4f(l, a, b, c, d); return this; }
  m4(n, m) { const l = this.u[n]; if (l) this.gl.uniformMatrix4fv(l, false, m); return this; }
}

export function createTextureArray(gl, size, layers, mips, { filter = 'pixel' } = {}) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D_ARRAY, t);
  gl.texStorage3D(gl.TEXTURE_2D_ARRAY, mips.length, gl.RGBA8, size, size, layers);
  let s = size;
  for (let l = 0; l < mips.length; l++) {
    gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, l, 0, 0, 0, s, s, layers, gl.RGBA, gl.UNSIGNED_BYTE, mips[l]);
    s = Math.max(1, s >> 1);
  }
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, filter === 'pixel' ? gl.NEAREST_MIPMAP_LINEAR : gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAX_LEVEL, mips.length - 1);
  const aniso = gl.getExtension('EXT_texture_filter_anisotropic');
  if (aniso && !/SwiftShader/i.test(gl.getParameter(gl.RENDERER) + (gl.getExtension('WEBGL_debug_renderer_info') ? gl.getParameter(gl.getExtension('WEBGL_debug_renderer_info').UNMASKED_RENDERER_WEBGL) : ''))) gl.texParameterf(gl.TEXTURE_2D_ARRAY, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(4, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
  return t;
}

export function createTexture2D(gl, w, h, data, { format = 'rgba', filter = 'linear', wrap = 'repeat', mip = false } = {}) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  const fmt = format === 'r8' ? gl.R8 : gl.RGBA8;
  const src = format === 'r8' ? gl.RED : gl.RGBA;
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, fmt, w, h, 0, src, gl.UNSIGNED_BYTE, data);
  const f = filter === 'linear' ? gl.LINEAR : gl.NEAREST;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? (filter === 'linear' ? gl.LINEAR_MIPMAP_LINEAR : gl.NEAREST_MIPMAP_LINEAR) : f);
  const wm = wrap === 'repeat' ? gl.REPEAT : gl.CLAMP_TO_EDGE;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wm);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wm);
  if (mip) gl.generateMipmap(gl.TEXTURE_2D);
  return t;
}
