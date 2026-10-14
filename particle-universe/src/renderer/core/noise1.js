// Smooth 1D value noise in [-1, 1] (for camera shake and UI motion).
const P = new Float32Array(512);
{
  let s = 1337;
  for (let i = 0; i < 256; i++) { s = (s * 1664525 + 1013904223) >>> 0; P[i] = P[i + 256] = (s / 4294967296) * 2 - 1; }
}
export function snoise1(x) {
  const i = Math.floor(x), f = x - i;
  const a = P[i & 255], b = P[(i + 1) & 255];
  const u = f * f * f * (f * (f * 6 - 15) + 10);
  return a + (b - a) * u;
}
