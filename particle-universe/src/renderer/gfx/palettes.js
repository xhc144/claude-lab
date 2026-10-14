// Colour palettes (sRGB stops → linear RGB lookup texture rows).

export const PALETTES = [
  { id: 'nebula', name: '星云', stops: [[0, '#05061a'], [0.18, '#1b2a6b'], [0.38, '#2e7fb8'], [0.55, '#69e0d9'], [0.74, '#c46bd8'], [0.9, '#ff9ab8'], [1, '#ffe9d6']] },
  { id: 'inferno', name: '熔金', stops: [[0, '#0a0204'], [0.15, '#4a0a0a'], [0.35, '#b3270b'], [0.55, '#f06c12'], [0.72, '#ffb347'], [0.88, '#ffe7a8'], [1, '#f2f6ff']] },
  { id: 'galaxy', name: '星河', stops: [[0, '#040615'], [0.2, '#1a2450'], [0.42, '#4d6fd1'], [0.62, '#b9cdfa'], [0.8, '#fff3e2'], [1, '#ffc477']] },
  { id: 'aurora', name: '极光', stops: [[0, '#020814'], [0.2, '#0b3d4f'], [0.45, '#12a37f'], [0.6, '#6ff2a6'], [0.78, '#4fb6ff'], [0.92, '#b892ff'], [1, '#ffe0ff']] },
  { id: 'plasma', name: '等离子', stops: [[0, '#050014'], [0.2, '#1b0f6b'], [0.42, '#3b4cff'], [0.6, '#39d5ff'], [0.78, '#e2f8ff'], [0.9, '#d78bff'], [1, '#ff6ae6']] },
  { id: 'neon', name: '霓虹', stops: [[0, '#0a0018'], [0.2, '#3a0a7a'], [0.4, '#8c1fff'], [0.6, '#ff2fb3'], [0.8, '#ff9a6b'], [1, '#fff2d6']] },
  { id: 'glacier', name: '冰川', stops: [[0, '#01040c'], [0.25, '#0c2346'], [0.5, '#2d6cb5'], [0.75, '#8ec9ff'], [1, '#eef8ff']] },
  { id: 'sunset', name: '落日', stops: [[0, '#0d0221'], [0.25, '#4a1a6b'], [0.45, '#b23a7a'], [0.65, '#f26b5b'], [0.82, '#ffb05c'], [1, '#fff1c1']] },
  { id: 'emerald', name: '翡翠', stops: [[0, '#010806'], [0.3, '#053d2e'], [0.55, '#0f9b6c'], [0.8, '#7bf2c2'], [1, '#f0fff8']] },
  { id: 'spectrum', name: '光谱', stops: [[0, '#ff3b6b'], [0.17, '#ffae3b'], [0.33, '#e9ff4a'], [0.5, '#3bff9b'], [0.67, '#3bc8ff'], [0.83, '#8a4bff'], [1, '#ff3bd2']] },
  { id: 'sakura', name: '樱花', stops: [[0, '#12040c'], [0.3, '#5a1d43'], [0.55, '#d45d9a'], [0.8, '#ffb3d1'], [1, '#fff3f8']] },
  { id: 'silver', name: '银辉', stops: [[0, '#000000'], [0.3, '#2a2d35'], [0.6, '#8a909e'], [0.85, '#e8ecf4'], [1, '#ffffff']] }
];

export const PALETTE_ROWS = 16;

const hex = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

export function paletteIndex(id) {
  const i = PALETTES.findIndex((p) => p.id === id);
  return i < 0 ? 0 : i;
}

export function paletteRowV(id) { return (paletteIndex(id) + 0.5) / PALETTE_ROWS; }

export function samplePalette(stops, t) {
  let i = 0;
  while (i < stops.length - 2 && t > stops[i + 1][0]) i++;
  const [p0, c0] = stops[i], [p1, c1] = stops[i + 1];
  const w = Math.max(0, Math.min(1, (t - p0) / Math.max(1e-6, p1 - p0)));
  const a = hex(c0), b = hex(c1);
  return [a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w, a[2] + (b[2] - a[2]) * w];
}

export function buildPaletteData() {
  const W = 256;
  const data = new Float32Array(W * PALETTE_ROWS * 4);
  PALETTES.forEach((p, row) => {
    for (let x = 0; x < W; x++) {
      const c = samplePalette(p.stops, x / (W - 1));
      const o = (row * W + x) * 4;
      data[o] = lin(c[0]); data[o + 1] = lin(c[1]); data[o + 2] = lin(c[2]); data[o + 3] = 1;
    }
  });
  return { data, width: W, height: PALETTE_ROWS };
}

export function paletteCss(p, from = 0.12) {
  const st = p.stops.filter(([t]) => t >= from - 0.001);
  return `linear-gradient(90deg, ${st.map(([t, c]) => `${c} ${Math.round(((t - from) / (1 - from)) * 100)}%`).join(', ')})`;
}
