// Seeded pseudo-random numbers. Every random decision in the simulation goes through an RNG whose
// state is a single 32-bit integer, so a world (and its whole history) is reproducible from its
// seed plus the player's actions, and the state is trivially saved with the world.

export class RNG {
  constructor(seed = 1) {
    this.s = (seed >>> 0) || 0x9e3779b9;
  }

  /** mulberry32: uniform float in [0, 1) */
  next() {
    let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  int(n) { return Math.floor(this.next() * n); }
  range(a, b) { return a + (b - a) * this.next(); }
  chance(p) { return this.next() < p; }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  sign() { return this.next() < 0.5 ? -1 : 1; }

  /** standard normal deviate (Box–Muller) */
  gauss() {
    let u = 0;
    while (u === 0) u = this.next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * this.next());
  }

  /** pick from items with weights given by fn(item) (non-negative); null if all weights are 0 */
  weighted(items, fn) {
    let total = 0;
    const w = new Array(items.length);
    for (let i = 0; i < items.length; i++) { w[i] = Math.max(0, fn(items[i], i)); total += w[i]; }
    if (total <= 0) return null;
    let r = this.next() * total;
    for (let i = 0; i < items.length; i++) { r -= w[i]; if (r < 0) return items[i]; }
    return items[items.length - 1];
  }

  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /** an independent child generator (deterministic given this generator's state) */
  fork() { return new RNG((this.next() * 4294967296) >>> 0); }
}

/** deterministic hash of two integers and a seed → float in [0, 1); used for per-cell detail */
export function hash2(x, y, seed = 0) {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** 32-bit FNV-1a hash of a string (used to turn text seeds into numbers) */
export function hashStr(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
