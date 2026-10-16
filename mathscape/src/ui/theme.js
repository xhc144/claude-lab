// Canvas palette (mirrors the CSS tokens in css/app.css).

export const C = {
  bg: '#0c1018',
  bgDeep: '#080b11',
  text: '#e8ecf4',
  text2: '#a9b2c4',
  text3: '#6d788d',
  gridMinor: 'rgba(148, 163, 184, 0.07)',
  gridMajor: 'rgba(148, 163, 184, 0.14)',
  axis: 'rgba(203, 213, 225, 0.42)',
  accent: '#7aa2ff',
  accent2: '#a78bfa',
  i: '#4ade80',
  j: '#fb7185',
  v: '#fbbf24',
  eig: '#c084fc',
  cyan: '#22d3ee',
  orange: '#fb923c',
  danger: '#ff6b81',
  ok: '#4ade80',
  warn: '#fbbf24',
  labelBg: 'rgba(10, 14, 22, 0.78)',
  bodies: ['#ffb454', '#5ccfe6', '#f28779', '#bae67e', '#d4bfff', '#ffd580'],
};

export const FONT = '"Inter", "PingFang SC", "Noto Sans CJK SC", "Microsoft YaHei", system-ui, sans-serif';
export const MONO = '"JetBrains Mono", "SF Mono", Menlo, Consolas, monospace';
export const MATH = '"Latin Modern Math", "STIX Two Math", "Cambria Math", "Times New Roman", serif';

/** rgba() from a #rrggbb colour. */
export function alpha(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/** Perceptual colour ramp (dark blue → violet → magenta → amber → pale yellow), t ∈ [0, 1]. */
const RAMP = [
  [0.0, [23, 32, 72]],
  [0.25, [62, 60, 160]],
  [0.5, [150, 70, 180]],
  [0.72, [235, 100, 120]],
  [0.88, [255, 170, 80]],
  [1.0, [255, 236, 170]],
];
export function ramp(t) {
  const x = Math.min(1, Math.max(0, t));
  for (let k = 1; k < RAMP.length; k++) {
    if (x <= RAMP[k][0]) {
      const [t0, c0] = RAMP[k - 1];
      const [t1, c1] = RAMP[k];
      const s = (x - t0) / (t1 - t0);
      return [c0[0] + s * (c1[0] - c0[0]), c0[1] + s * (c1[1] - c0[1]), c0[2] + s * (c1[2] - c0[2])];
    }
  }
  return RAMP.at(-1)[1];
}
export const rampCss = (t, a = 1) => {
  const [r, g, b] = ramp(t);
  return `rgba(${r | 0}, ${g | 0}, ${b | 0}, ${a})`;
};
