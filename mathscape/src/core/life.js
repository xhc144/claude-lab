// Cellular automata. Two-dimensional "Life-like" rules Bx/Sy on a torus (a dead cell with x live
// neighbours is born, a live cell with y live neighbours survives; Conway's Life is B3/S23), and
// Wolfram's elementary one-dimensional rules 0 … 255.

/** "B3/S23" (or the older "23/3" = S/B) → { born, survive: Uint8Array(9), text }. */
export function parseRule(text) {
  const table = (s) => { const t = new Uint8Array(9); for (const ch of s) t[+ch] = 1; return t; };
  let m = /^\s*B([0-8]*)\s*\/?\s*S([0-8]*)\s*$/i.exec(text);
  if (m) return { born: table(m[1]), survive: table(m[2]), text: `B${[...new Set(m[1])].sort().join('')}/S${[...new Set(m[2])].sort().join('')}` };
  m = /^\s*([0-8]*)\s*\/\s*([0-8]*)\s*$/.exec(text);
  if (m) return parseRule(`B${m[2]}/S${m[1]}`);
  throw new Error('规则的格式应为 B3/S23：B 后是出生所需的邻居数，S 后是存活所需的邻居数');
}

/** Run-length encoded pattern ("bo$2bo$3o!") → { w, h, cells: [[x, y], …] }. */
export function parseRLE(rle) {
  const cells = [];
  let x = 0, y = 0, n = '';
  let w = 0;
  for (const ch of rle.replace(/\s+/g, '')) {
    if (ch >= '0' && ch <= '9') { n += ch; continue; }
    const k = n ? parseInt(n, 10) : 1;
    n = '';
    if (ch === 'b' || ch === '.') x += k;
    else if (ch === 'o' || ch === 'A') { for (let i = 0; i < k; i++) cells.push([x + i, y]); x += k; }
    else if (ch === '$') { y += k; x = 0; }
    else if (ch === '!') break;
    w = Math.max(w, x);
  }
  return { w, h: y + 1, cells };
}

export const PATTERNS = {
  glider: { label: '滑翔机', rle: 'bob$2bo$3o!', note: '每 4 代沿对角线移动一格。' },
  lwss: { label: '轻型飞船', rle: 'bo2bo$o4b$o3bo$4o!', note: '每 4 代水平移动两格。' },
  pulsar: { label: '脉冲星', rle: '2b3o3b3o2b2$o4bobo4bo$o4bobo4bo$o4bobo4bo$2b3o3b3o2b2$2b3o3b3o2b$o4bobo4bo$o4bobo4bo$o4bobo4bo2$2b3o3b3o!', note: '周期 3 的振荡器。' },
  penta: { label: '十五项', rle: '2bo4bo2b$2ob4ob2o$2bo4bo!', note: '周期 15 的振荡器。' },
  gun: { label: '高斯帕滑翔机枪', rle: '24bo$22bobo$12b2o6b2o12b2o$11bo3bo4b2o12b2o$2o8bo5bo3b2o$2o8bo3bob2o4bobo$10bo5bo7bo$11bo3bo$12b2o!', note: '1970 年发现的第一个无限增长的图案：每 30 代射出一架滑翔机。' },
  rpent: { label: 'R 五连块', rle: 'b2o$2ob$bo!', note: '只有 5 个细胞，却要折腾 1103 代才稳定下来。' },
  acorn: { label: '橡子', rle: 'bo5b$3bo3b$2o2b3o!', note: '7 个细胞，5206 代后才稳定。' },
  diehard: { label: '顽固者', rle: '6bob$2o6b$bo3b3o!', note: '恰好在第 130 代全部死亡。' },
};

export class Life {
  constructor(w, h, rule = parseRule('B3/S23')) {
    this.w = w;
    this.h = h;
    this.rule = rule;
    this.cells = new Uint8Array(w * h);
    this.next = new Uint8Array(w * h);
    this.age = new Uint16Array(w * h);
    this.heat = new Float32Array(w * h); // fading trail of recently dead cells
    this.gen = 0;
    this.seen = new Map(); // state hash → generation (cycle detection)
    this.cycle = null; // { start, period }
  }

  idx(x, y) { return ((y % this.h) + this.h) % this.h * this.w + (((x % this.w) + this.w) % this.w); }
  get(x, y) { return this.cells[this.idx(x, y)]; }
  set(x, y, v) {
    const i = this.idx(x, y);
    this.cells[i] = v ? 1 : 0;
    this.age[i] = v ? 1 : 0;
    if (!v) this.heat[i] = Math.max(this.heat[i], 0.6);
    this.edited();
  }
  edited() { this.seen.clear(); this.cycle = null; }

  clear() { this.cells.fill(0); this.age.fill(0); this.heat.fill(0); this.gen = 0; this.edited(); }

  /** Random soup of the given density inside the central fraction `area` of the grid. */
  randomize(density = 0.3, random = Math.random, area = 1) {
    this.clear();
    const x0 = Math.floor((this.w * (1 - area)) / 2), y0 = Math.floor((this.h * (1 - area)) / 2);
    for (let y = y0; y < this.h - y0; y++) {
      for (let x = x0; x < this.w - x0; x++) {
        if (random() < density) { const i = y * this.w + x; this.cells[i] = 1; this.age[i] = 1; }
      }
    }
  }

  place(pattern, cx, cy, { rotate = 0, flip = false } = {}) {
    const p = typeof pattern === 'string' ? parseRLE(pattern) : pattern;
    for (let [x, y] of p.cells) {
      x -= Math.floor(p.w / 2);
      y -= Math.floor(p.h / 2);
      if (flip) x = -x;
      for (let r = 0; r < rotate; r++) [x, y] = [-y, x];
      const i = this.idx(cx + x, cy + y);
      this.cells[i] = 1;
      this.age[i] = 1;
    }
    this.edited();
  }

  population() { let n = 0; for (let i = 0; i < this.cells.length; i++) n += this.cells[i]; return n; }

  step() {
    // remember the starting state, so returning to it counts as a cycle
    if (!this.seen.size && !this.cycle) this.seen.set(this.hash(), this.gen);
    const { w, h, cells, next, age, heat } = this;
    const { born, survive } = this.rule;
    for (let y = 0; y < h; y++) {
      const up = ((y + h - 1) % h) * w, mid = y * w, dn = ((y + 1) % h) * w;
      for (let x = 0; x < w; x++) {
        const l = x === 0 ? w - 1 : x - 1, r = x === w - 1 ? 0 : x + 1;
        const n = cells[up + l] + cells[up + x] + cells[up + r] + cells[mid + l] + cells[mid + r] + cells[dn + l] + cells[dn + x] + cells[dn + r];
        const i = mid + x;
        const alive = cells[i] ? survive[n] : born[n];
        next[i] = alive;
        if (alive) age[i] = cells[i] ? Math.min(65535, age[i] + 1) : 1;
        else { if (cells[i]) heat[i] = 1; else heat[i] *= 0.86; age[i] = 0; }
      }
    }
    this.cells = next;
    this.next = cells;
    this.gen++;
    this.detectCycle();
  }

  /** FNV-1a hash of the packed state. */
  hash() {
    let hsh = 2166136261;
    const c = this.cells;
    for (let i = 0; i < c.length; i += 8) {
      const byte = c[i] | (c[i + 1] << 1) | (c[i + 2] << 2) | (c[i + 3] << 3) | (c[i + 4] << 4) | (c[i + 5] << 5) | (c[i + 6] << 6) | (c[i + 7] << 7);
      hsh = Math.imul(hsh ^ byte, 16777619);
    }
    return hsh;
  }

  detectCycle() {
    if (this.cycle) return;
    const hsh = this.hash();
    const prev = this.seen.get(hsh);
    if (prev !== undefined) { this.cycle = { start: prev, period: this.gen - prev }; return; }
    if (this.seen.size > 20000) this.seen.clear();
    this.seen.set(hsh, this.gen);
  }
}

/** Space-time diagram of elementary rule `rule` (0–255): gens rows × width cells, periodic. */
export function elementary(rule, width, gens, init = 'single', random = Math.random) {
  const out = new Uint8Array(width * gens);
  if (init === 'single') out[Math.floor(width / 2)] = 1;
  else for (let x = 0; x < width; x++) out[x] = random() < 0.5 ? 1 : 0;
  for (let g = 1; g < gens; g++) {
    const prev = (g - 1) * width, cur = g * width;
    for (let x = 0; x < width; x++) {
      const l = out[prev + ((x + width - 1) % width)], c = out[prev + x], r = out[prev + ((x + 1) % width)];
      out[cur + x] = (rule >> ((l << 2) | (c << 1) | r)) & 1;
    }
  }
  return out;
}

export const RULES_1D = [
  { rule: 30, label: '规则 30', note: '从一个细胞长出混沌：中间一列被用作随机数发生器。' },
  { rule: 90, label: '规则 90', note: '每个细胞等于两个邻居的异或：画出谢尔宾斯基三角（帕斯卡三角模 2）。' },
  { rule: 110, label: '规则 110', note: '已被证明是图灵完备的：能模拟任何计算。' },
  { rule: 184, label: '规则 184', note: '交通流模型：1 是车，前方空着就向右走一格。' },
  { rule: 150, label: '规则 150', note: '三个细胞的异或，同样是自相似图案。' },
  { rule: 73, label: '规则 73', note: '一维也能有“墙”：随机初值下出现稳定的竖条。' },
];
