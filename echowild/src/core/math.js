// Small linear-algebra kit: column-major 4×4 matrices (WebGL convention) and scalar helpers.

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const fract = (x) => x - Math.floor(x);
export const mod = (a, n) => ((a % n) + n) % n;
export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

export function angleLerp(a, b, t) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return a + d * t;
}

export function mat4() {
  const m = new Float32Array(16);
  m[0] = m[5] = m[10] = m[15] = 1;
  return m;
}

export function identity(m) {
  m.fill(0);
  m[0] = m[5] = m[10] = m[15] = 1;
  return m;
}

export function perspective(out, fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2);
  const nf = 1 / (near - far);
  out.fill(0);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) * nf;
  out[11] = -1;
  out[14] = 2 * far * near * nf;
  return out;
}

export function ortho(out, l, r, b, t, n, f) {
  out.fill(0);
  out[0] = 2 / (r - l);
  out[5] = 2 / (t - b);
  out[10] = -2 / (f - n);
  out[12] = -(r + l) / (r - l);
  out[13] = -(t + b) / (t - b);
  out[14] = -(f + n) / (f - n);
  out[15] = 1;
  return out;
}

export function multiply(out, a, b) {
  const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
  const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
  const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
  const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
  for (let i = 0; i < 4; i++) {
    const b0 = b[i * 4], b1 = b[i * 4 + 1], b2 = b[i * 4 + 2], b3 = b[i * 4 + 3];
    out[i * 4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[i * 4 + 1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[i * 4 + 2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[i * 4 + 3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
  }
  return out;
}

export function translate(out, a, x, y, z) {
  if (out !== a) out.set(a);
  out[12] = a[0] * x + a[4] * y + a[8] * z + a[12];
  out[13] = a[1] * x + a[5] * y + a[9] * z + a[13];
  out[14] = a[2] * x + a[6] * y + a[10] * z + a[14];
  out[15] = a[3] * x + a[7] * y + a[11] * z + a[15];
  return out;
}

export function scale(out, a, x, y, z) {
  for (let i = 0; i < 4; i++) {
    out[i] = a[i] * x;
    out[4 + i] = a[4 + i] * y;
    out[8 + i] = a[8 + i] * z;
    out[12 + i] = a[12 + i];
  }
  return out;
}

const RT = new Float32Array(16);
function rotAxis(out, a, rad, ax) {
  const s = Math.sin(rad), c = Math.cos(rad);
  const t = RT;
  t.set(a);
  // columns i and j get mixed
  const [i, j, sign] = ax === 0 ? [1, 2, 1] : ax === 1 ? [2, 0, 1] : [0, 1, 1];
  for (let k = 0; k < 4; k++) {
    const ai = t[i * 4 + k], aj = t[j * 4 + k];
    out[i * 4 + k] = ai * c + aj * s * sign;
    out[j * 4 + k] = aj * c - ai * s * sign;
  }
  if (out !== a) {
    const other = 3 - i - j;
    for (let k = 0; k < 4; k++) {
      out[other * 4 + k] = t[other * 4 + k];
      out[12 + k] = t[12 + k];
    }
  }
  return out;
}
export const rotateX = (out, a, r) => rotAxis(out, a, r, 0);
export const rotateY = (out, a, r) => rotAxis(out, a, r, 1);
export const rotateZ = (out, a, r) => rotAxis(out, a, r, 2);

export function invert(out, a) {
  const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
  const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
  const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
  const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
  const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10;
  const b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31;
  const b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
  let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (!det) return null;
  det = 1 / det;
  out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
  out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
  out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
  out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
  out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
  out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
  out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
  out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
  out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
  out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
  out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
  out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
  out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
  out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
  out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
  out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
  return out;
}

// View matrix for a first-person camera: yaw around +Y (0 = looking toward -Z), pitch around X.
export function fpsView(out, x, y, z, yaw, pitch) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  // camera basis
  const rx = cy, ry = 0, rz = -sy;               // right
  const ux = sy * sp, uy = cp, uz = cy * sp;     // up
  const fx = -sy * cp, fy = sp, fz = -cy * cp;   // forward
  out[0] = rx; out[1] = ux; out[2] = -fx; out[3] = 0;
  out[4] = ry; out[5] = uy; out[6] = -fy; out[7] = 0;
  out[8] = rz; out[9] = uz; out[10] = -fz; out[11] = 0;
  out[12] = -(rx * x + ry * y + rz * z);
  out[13] = -(ux * x + uy * y + uz * z);
  out[14] = (fx * x + fy * y + fz * z);
  out[15] = 1;
  return out;
}

export function lookDir(yaw, pitch) {
  const cp = Math.cos(pitch);
  return [-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp];
}

// Frustum planes from a view-projection matrix (Gribb–Hartmann). planes: Float32Array(24)
export function frustumPlanes(planes, m) {
  const rows = [
    [m[3] + m[0], m[7] + m[4], m[11] + m[8], m[15] + m[12]],
    [m[3] - m[0], m[7] - m[4], m[11] - m[8], m[15] - m[12]],
    [m[3] + m[1], m[7] + m[5], m[11] + m[9], m[15] + m[13]],
    [m[3] - m[1], m[7] - m[5], m[11] - m[9], m[15] - m[13]],
    [m[3] + m[2], m[7] + m[6], m[11] + m[10], m[15] + m[14]],
    [m[3] - m[2], m[7] - m[6], m[11] - m[10], m[15] - m[14]],
  ];
  for (let i = 0; i < 6; i++) {
    const [a, b, c, d] = rows[i];
    const l = Math.hypot(a, b, c) || 1;
    planes[i * 4] = a / l; planes[i * 4 + 1] = b / l; planes[i * 4 + 2] = c / l; planes[i * 4 + 3] = d / l;
  }
  return planes;
}

export function aabbInFrustum(planes, x0, y0, z0, x1, y1, z1) {
  for (let i = 0; i < 24; i += 4) {
    const a = planes[i], b = planes[i + 1], c = planes[i + 2], d = planes[i + 3];
    const x = a > 0 ? x1 : x0, y = b > 0 ? y1 : y0, z = c > 0 ? z1 : z0;
    if (a * x + b * y + c * z + d < 0) return false;
  }
  return true;
}

export function hexToRgb(hex) {
  const v = parseInt(hex.replace('#', ''), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
