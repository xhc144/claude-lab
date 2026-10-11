// Number formatting for readouts.

/** Compact, trimmed decimal: fmt(1.50000) = "1.5", fmt(-0) = "0", fmt(1e-9) = "1.00e-9". */
export function fmt(x, digits = 3) {
  if (Number.isNaN(x)) return '—';
  if (x === Infinity) return '∞';
  if (x === -Infinity) return '−∞';
  const ax = Math.abs(x);
  if (ax !== 0 && (ax < 10 ** -digits || ax >= 1e6)) {
    const [m, e] = x.toExponential(Math.max(1, digits - 1)).split('e');
    return `${m.replace('-', '−')}e${e.replace('+', '')}`;
  }
  let s = x.toFixed(digits);
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
  if (s === '-0') s = '0';
  return s.replace('-', '−');
}

/** a + bi with a proper minus sign. */
export function fmtComplex(re, im, digits = 3) {
  if (!Number.isFinite(re) || !Number.isFinite(im)) {
    if (Number.isNaN(re) || Number.isNaN(im)) return '未定义';
    return '∞';
  }
  const r = fmt(re, digits);
  const iAbs = fmt(Math.abs(im), digits);
  if (iAbs === '0') return r;
  const sign = im < 0 ? '−' : '+';
  const iPart = iAbs === '1' ? 'i' : `${iAbs}i`;
  if (r === '0') return im < 0 ? `−${iPart}` : iPart;
  return `${r} ${sign} ${iPart}`;
}

export const fmtVec = (x, y, digits = 2) => `(${fmt(x, digits)}, ${fmt(y, digits)})`;

export const deg = (rad) => `${fmt((rad * 180) / Math.PI, 1)}°`;
