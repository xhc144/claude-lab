// Double-double arithmetic: a value is an unevaluated sum hi + lo of two doubles with
// |lo| ≤ ulp(hi)/2, about 32 significant digits — fast enough for inner loops that iterate a map
// hundreds of thousands of times (BigInt arithmetic would be far slower there).
// Error-free transformations: Knuth's TwoSum and Dekker's TwoProduct (with Veltkamp splitting).

const SPLIT = 134217729; // 2^27 + 1

export const dd = (hi, lo = 0) => [hi, lo];

function quickTwoSum(a, b) {
  const s = a + b;
  return [s, b - (s - a)];
}

export function add(a, b) {
  const s = a[0] + b[0];
  const bb = s - a[0];
  const e = a[0] - (s - bb) + (b[0] - bb) + a[1] + b[1];
  return quickTwoSum(s, e);
}

export const neg = (a) => [-a[0], -a[1]];
export const sub = (a, b) => add(a, neg(b));

function twoProd(a, b) {
  const p = a * b;
  const a1 = SPLIT * a, ah = a1 - (a1 - a), al = a - ah;
  const b1 = SPLIT * b, bh = b1 - (b1 - b), bl = b - bh;
  return [p, ah * bh - p + ah * bl + al * bh + al * bl];
}

export function mul(a, b) {
  const [p, e] = twoProd(a[0], b[0]);
  return quickTwoSum(p, e + a[0] * b[1] + a[1] * b[0]);
}

export function mulNum(a, k) {
  const [p, e] = twoProd(a[0], k);
  return quickTwoSum(p, e + a[1] * k);
}

export function div(a, b) {
  const q1 = a[0] / b[0];
  let r = sub(a, mulNum(b, q1));
  const q2 = r[0] / b[0];
  r = sub(r, mulNum(b, q2));
  const q3 = r[0] / b[0];
  return add(quickTwoSum(q1, q2), [q3, 0]);
}

export function sqrt(a) {
  if (a[0] <= 0) return [0, 0];
  const x = Math.sqrt(a[0]);
  // one Newton step in double-double: x + (a − x²)/(2x)
  return add([x, 0], [sub(a, twoProd(x, x))[0] / (2 * x), 0]);
}

export const toNumber = (a) => a[0] + a[1];
