// Deterministic, harmonious avatar colours and initials for senders.
const PALETTE = [
  ['#e9d5c9', '#8a4a2c'], ['#d6e2d3', '#3e6b45'], ['#d3dceb', '#3a5585'], ['#ead9c0', '#8a611d'],
  ['#e2d4e6', '#6a4682'], ['#d2e3e1', '#2d6e66'], ['#ecd3d5', '#8f3f4b'], ['#dcdccc', '#5c5c33'],
  ['#d7d9e8', '#4b4f86'], ['#e8dccf', '#7a5536']
];
const PALETTE_DARK = [
  ['#3b2a22', '#f0b59a'], ['#26342a', '#9fd3a8'], ['#232c3d', '#a7bde8'], ['#3a301f', '#e8c37a'],
  ['#322638', '#cfb0e4'], ['#1f3433', '#93d3c9'], ['#3a2428', '#eeaab4'], ['#2f2f22', '#d2d29a'],
  ['#272a3b', '#b4b8ea'], ['#36291f', '#e2bb98']
];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function avatarColors(key: string, dark: boolean): { bg: string; fg: string } {
  const p = dark ? PALETTE_DARK : PALETTE;
  const [bg, fg] = p[hash(key.toLowerCase()) % p.length];
  return { bg, fg };
}

export function initials(name: string, address: string): string {
  const src = (name || address.split('@')[0] || '?').trim();
  const cjk = src.match(/[一-鿿㐀-䶿]/g);
  if (cjk && cjk.length) {
    // Chinese names: use the last one or two characters (given name), e.g. 张伟 → 伟, 欧阳娜娜 → 娜娜.
    const chars = src.replace(/[^一-鿿㐀-䶿]/g, '');
    if (chars.length >= 4) return chars[0]; // organisations: 招商银行信用卡 → 招
    return chars.length <= 2 ? chars.slice(-1) : chars.slice(-2);
  }
  const words = src.replace(/[^A-Za-z0-9\s._-]/g, ' ').split(/[\s._-]+/).filter(Boolean);
  if (!words.length) return src.slice(0, 1).toUpperCase();
  if (words.length === 1) {
    // CamelCase brands: GitHub → GH, LinkedIn → LI; plain words: Trip → T
    const caps = words[0].match(/[A-Z]/g);
    return caps && caps.length >= 2 ? caps.slice(0, 2).join('') : words[0][0].toUpperCase();
  }
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}
