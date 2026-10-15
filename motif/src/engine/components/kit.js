// Shared building blocks for components: animated text, cards, icons, numbers.
import ICONS from '../../generated/icons.json';
import { drawLayout, roundRect } from '../text/text.js';
import { enterState, applyState, IDENTITY } from '../motion/presets.js';
import { EASE, clamp01, prog } from '../motion/easing.js';
import { motionParams, colorOf } from '../env.js';
import { toCss, mix, isDark } from '../../core/util/color.js';

export { roundRect, EASE, clamp01, prog, enterState, applyState, IDENTITY, colorOf };

// ───────────────────────────── roles & paint ─────────────────────────────
export function role(env, name, extra) {
  const r = env.fonts[name] || env.fonts.text;
  return extra ? { ...r, ...extra } : r;
}

export function paintFor(c, color, opts = {}) {
  const { env, p } = c;
  const th = env.theme;
  const accent = opts.accent || p.accentText;
  const grad = th.decor?.glow && p.gradient && p.tone === 'base';
  return {
    color: color || p.ink,
    accent,
    accentFill: grad && !opts.flat ? (ctx, box) => {
      const g = ctx.createLinearGradient(box.x, box.y, box.x + Math.max(box.w, 40), box.y + box.h);
      const cs = p.gradient;
      cs.forEach((col, i) => g.addColorStop(i / (cs.length - 1), col));
      return g;
    } : null,
    glow: th.decor?.glow && !opts.flat ? toCss(p.accent, 0.35) : null,
    mark: p.highlight,
    codeBg: toCss(p.ink, 0.1),
    code: p.ink,
  };
}

// ───────────────────────────── animated text ─────────────────────────────
/**
 * Build a timing function for a text layout.
 * @returns {{ duration:number, state:(u,line,t)=>state|false|null }}
 */
export function textAnimator(env, L, preset, o = {}) {
  const m = env.motion;
  const speed = o.speed || 1;
  const unitMode = o.unit || (preset === 'mask-up' || preset === 'focus' || preset === 'mask-left' ? 'line' : m.unit);
  const dur = (o.duration ?? m.duration) / speed;
  const mp = motionParams(env, L.size, { h: L.lineHeight });
  const n = L.unitCount || 1;
  const nl = L.lines.length;
  if (preset === 'none') return { duration: 0, state: () => null };
  if (preset === 'type') {
    // typewriter: characters appear in reading order at a steady rate
    const total = L.lines.reduce((s, l) => s + l.units.reduce((a, u) => a + (u.k === 'sp' ? 1 : [...u.t].length), 0), 0);
    const cps = (o.cps || 34) * (0.7 + env.energy * 0.6) * speed;
    let acc = 0;
    const starts = new Map();
    for (const l of L.lines) for (const u of l.units) { starts.set(u, acc); acc += u.k === 'sp' ? 1 : [...u.t].length; }
    return {
      duration: total / cps,
      typing: true,
      state: (u, line, t) => {
        const s0 = starts.get(u) ?? 0;
        const shown = Math.floor(t * cps - s0);
        if (shown <= 0) return false;
        const len = [...u.t].length;
        return shown >= len ? (u.s.mark ? { ...IDENTITY, done: false, alpha: 1, markProgress: clamp01((t * cps - s0 - len) / 8) } : null) : { ...IDENTITY, done: false, alpha: 1, typeChars: shown };
      },
      caret: (t) => { const k = Math.floor(t * cps); return k < total ? k : -1; },
    };
  }
  let spread;
  let delayOf;
  if (unitMode === 'line') {
    const per = Math.min(m.stagger * 1.6, (o.maxSpread ?? 1.4) / Math.max(1, nl - 1 || 1));
    delayOf = (u, line) => line.index * per;
    spread = (nl - 1) * per;
  } else {
    const base = unitMode === 'char' ? m.stagger * 0.38 : m.stagger * 0.55;
    const per = Math.min(base, (o.maxSpread ?? 1.2) / Math.max(1, n - 1));
    delayOf = (u) => u.order * per;
    spread = (n - 1) * per;
  }
  const unitDur = unitMode === 'char' ? dur * 0.75 : dur;
  return {
    duration: spread + unitDur,
    state: (u, line, t) => {
      const local = t - delayOf(u, line);
      if (local <= 0) return false;
      const p = local / unitDur;
      const s = enterState(preset, p, { ...mp, w: u.w });
      if (u.s.mark) return { ...s, done: false, markProgress: clamp01((local - unitDur * 0.5) / 0.5) };
      return p >= 1 ? null : s;
    },
  };
}

/** Draw text layout L at rect with an animator at local time t. */
// Anchor recorder: while a scene with an explanation track (guide) renders, components report
// where their text and items landed this frame, so the pointer can find "this phrase" or "item 2"
// without each component re-deriving its own layout.
// Positions are stored with the canvas transform current at record time (m), so text drawn inside
// a translate/scale still maps back to scene coordinates.
export const REC = { on: false, block: null, item: null, texts: [], items: [] };
/** Mark the start of item i (0-based) in a list-like component; box = its frame or marker, if any. */
export function recItem(i, box, ctx, key) {
  if (!REC.on) return;
  REC.item = i;
  REC.items.push({ block: REC.block, i, box: box ? { x: box.x, y: box.y, w: box.w, h: box.h } : null, m: ctx ? ctx.getTransform() : null, key });
}

export function drawText(ctx, L, x, y, w, paint, anim, t) {
  if (REC.on && L?.lines) REC.texts.push({ block: REC.block, item: REC.item, L, x, y, w, m: ctx.getTransform() });
  if (!anim) return drawLayout(ctx, L, x, y, w, paint, null, applyState);
  drawLayout(ctx, L, x, y, w, paint, (u, line) => anim.state(u, line, t), applyState);
  if (anim.caret) {
    const k = anim.caret(t);
    if (k >= 0 && Math.floor(t * 2.2) % 2 === 0) {
      // find caret position
      let acc = 0;
      outer: for (const line of L.lines) {
        const ox = L.align === 'center' ? (w - line.width) / 2 : L.align === 'right' ? w - line.width : 0;
        for (const u of line.units) {
          const len = u.k === 'sp' ? 1 : [...u.t].length;
          if (acc + len > k) {
            const frac = (k - acc) / len;
            ctx.fillStyle = paint.accent || paint.color;
            ctx.fillRect(x + ox + u.x + u.w * frac, y + line.y + L.lineHeight * 0.15, Math.max(2, L.size * 0.07), L.lineHeight * 0.75);
            break outer;
          }
          acc += len;
        }
      }
    }
  }
}

// ───────────────────────────── block-level entrance ─────────────────────────────
export function blockState(c, t, preset, o = {}) {
  const { env } = c;
  const dur = (o.duration ?? env.motion.duration) / (o.speed || 1);
  if (t <= 0) return false;
  const p = t / dur;
  if (p >= 1) return IDENTITY;
  return enterState(preset || 'rise', p, motionParams(env, o.size || env.sizes.body, o));
}

/** Run fn inside save/restore with a block entrance state applied. */
export function withState(ctx, st, box, fn, pivot) {
  if (st === false) return;
  ctx.save();
  if (st && st !== IDENTITY) {
    if (!applyState(ctx, st, box, pivot)) { ctx.restore(); return; }
  }
  fn(st);
  ctx.restore();
}

/** Map theme entrance to a block-friendly preset (whole cards/visuals can't line-mask nicely). */
export function blockPreset(env, explicit) {
  if (explicit && explicit !== 'auto') return explicit;
  const e = env.motion.enter;
  return { 'mask-up': 'rise', 'mask-left': 'slide-right', write: 'rise-blur', type: 'wipe', brush: 'ink' }[e] || e;
}

// ───────────────────────────── cards ─────────────────────────────
export function drawCard(ctx, c, r, o = {}) {
  const { env, p } = c;
  const kind = o.kind || env.theme.shape.card;
  const rad = o.radius ?? env.theme.shape.radius * env.unit;
  const sw = env.theme.shape.stroke * env.unit;
  ctx.save();
  switch (kind) {
    case 'glass': {
      roundRect(ctx, r.x, r.y, r.w, r.h, rad);
      const g = ctx.createLinearGradient(r.x, r.y, r.x + r.w * 0.6, r.y + r.h);
      g.addColorStop(0, toCss(p.ink, p.dark ? 0.09 : 0.06));
      g.addColorStop(1, toCss(p.ink, p.dark ? 0.03 : 0.02));
      ctx.fillStyle = g;
      ctx.fill();
      ctx.lineWidth = sw;
      const sg = ctx.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h);
      sg.addColorStop(0, toCss(p.ink, 0.28));
      sg.addColorStop(0.5, toCss(p.ink, 0.06));
      sg.addColorStop(1, toCss(p.ink, 0.14));
      ctx.strokeStyle = sg;
      ctx.stroke();
      break;
    }
    case 'elevated': {
      roundRect(ctx, r.x, r.y, r.w, r.h, rad);
      ctx.shadowColor = p.shadow;
      ctx.shadowBlur = 40 * env.unit;
      ctx.shadowOffsetY = 14 * env.unit;
      ctx.fillStyle = p.surface;
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.lineWidth = 1;
      ctx.strokeStyle = toCss(p.ink, 0.05);
      ctx.stroke();
      break;
    }
    case 'brutal': {
      const off = 10 * env.unit;
      roundRect(ctx, r.x + off, r.y + off, r.w, r.h, rad);
      ctx.fillStyle = p.line || '#111';
      ctx.fill();
      roundRect(ctx, r.x, r.y, r.w, r.h, rad);
      ctx.fillStyle = o.fill || p.surface;
      ctx.fill();
      ctx.lineWidth = sw;
      ctx.strokeStyle = p.line || '#111';
      ctx.stroke();
      break;
    }
    case 'paper': {
      roundRect(ctx, r.x, r.y, r.w, r.h, rad);
      ctx.fillStyle = toCss(p.surface, 0.85);
      ctx.fill();
      ctx.fillStyle = p.accent;
      ctx.fillRect(r.x, r.y, r.w, Math.max(2, 3 * env.unit));
      break;
    }
    case 'outline': {
      roundRect(ctx, r.x, r.y, r.w, r.h, rad);
      ctx.fillStyle = p.surface;
      ctx.fill();
      ctx.lineWidth = sw;
      ctx.strokeStyle = p.line;
      ctx.stroke();
      if (env.theme.decor?.ticks) cornerTicks(ctx, r, 12 * env.unit, p.accent, sw * 1.4);
      break;
    }
    case 'line': {
      ctx.fillStyle = p.surface;
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = p.line;
      ctx.lineWidth = 1;
      ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
      break;
    }
    case 'flat':
    default: {
      roundRect(ctx, r.x, r.y, r.w, r.h, rad);
      ctx.fillStyle = o.fill || p.surface;
      ctx.fill();
    }
  }
  ctx.restore();
}

export function cornerTicks(ctx, r, len, color, lw) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.beginPath();
  for (const [x, y, dx, dy] of [[r.x, r.y, 1, 1], [r.x + r.w, r.y, -1, 1], [r.x, r.y + r.h, 1, -1], [r.x + r.w, r.y + r.h, -1, -1]]) {
    ctx.moveTo(x, y + dy * len); ctx.lineTo(x, y); ctx.lineTo(x + dx * len, y);
  }
  ctx.stroke();
  ctx.restore();
}

// ───────────────────────────── icons ─────────────────────────────
const iconCache = new Map();
const KEYWORDS = [
  [/增长|上升|提升|增加|grow|growth|increase|rise|up\b/i, 'trending-up'], [/下降|减少|降低|decline|decrease|down\b/i, 'trending-down'],
  [/安全|隐私|保护|secure|security|privacy|protect/i, 'shield-check'], [/速度|快|性能|高效|fast|speed|performance|quick/i, 'zap'],
  [/用户|客户|人|团队|user|customer|people|team/i, 'users'], [/全球|国际|世界|global|world|international/i, 'globe'],
  [/数据|分析|统计|data|analytics|statistics/i, 'chart-column'], [/AI|人工智能|智能|模型|machine learning|intelligence/i, 'sparkles'],
  [/云|cloud/i, 'cloud'], [/钱|成本|收入|营收|价格|费用|money|cost|revenue|price/i, 'banknote'], [/时间|效率|time|hour|schedule/i, 'clock'],
  [/目标|定位|target|goal|aim/i, 'target'], [/创新|想法|灵感|idea|innovation|insight/i, 'lightbulb'], [/设计|美观|design|style/i, 'palette'],
  [/代码|开发|编程|code|develop|program/i, 'code'], [/学习|教育|课程|learn|education|course|study/i, 'graduation-cap'], [/健康|医疗|health|medical/i, 'heart-pulse'],
  [/环境|绿色|可持续|环保|green|sustain|eco|environment/i, 'leaf'], [/连接|网络|集成|connect|network|integrat/i, 'network'], [/手机|移动|mobile|phone/i, 'smartphone'],
  [/消息|沟通|聊天|message|chat|communicat/i, 'message-circle'], [/文件|文档|报告|file|document|report/i, 'file-text'], [/搜索|发现|search|discover|find/i, 'search'],
  [/设置|配置|工具|setting|config|tool/i, 'settings'], [/锁|权限|lock|permission/i, 'lock'], [/奖|第一|冠军|award|win|best/i, 'trophy'],
  [/火箭|发布|上线|launch|rocket|ship/i, 'rocket'], [/视频|影片|video|film|movie/i, 'clapperboard'], [/图片|照片|image|photo/i, 'image'],
  [/音乐|音频|music|audio|sound/i, 'music'], [/地图|位置|地点|map|location|place/i, 'map-pin'], [/购物|电商|销售|shop|commerce|sale|retail/i, 'shopping-cart'],
  [/工厂|制造|生产|factory|manufactur|production/i, 'factory'], [/能源|电力|电池|energy|power|battery/i, 'battery-charging'], [/服务器|算力|硬件|server|compute|hardware|gpu/i, 'server'],
  [/芯片|处理器|cpu|chip|processor/i, 'cpu'], [/书|阅读|book|read/i, 'book-open'], [/星|评价|评分|star|rating|review/i, 'star'], [/心|喜欢|爱|heart|love|like/i, 'heart'],
  [/检查|完成|验证|check|done|verify|complete/i, 'circle-check'], [/警告|风险|注意|warning|risk|alert/i, 'triangle-alert'], [/问题|疑问|question|why/i, 'circle-help'],
  [/对话|协作|合作|collaborat|partner|together/i, 'handshake'], [/建筑|公司|企业|building|company|enterprise/i, 'building-2'], [/车|交通|物流|car|transport|logistic|delivery/i, 'truck'],
  [/天气|太阳|sun|weather/i, 'sun'], [/水|海洋|water|ocean/i, 'droplets'], [/实验|科学|研究|lab|science|research|experiment/i, 'flask-conical'], [/数学|公式|math|formula/i, 'sigma'],
  [/日历|日期|计划|calendar|date|plan/i, 'calendar'], [/邮件|email|mail/i, 'mail'], [/导入|上传|import|upload/i, 'upload'], [/导出|下载|export|download/i, 'download'],
  [/自动|魔法|一键|auto|magic|automat/i, 'wand-sparkles'], [/编辑|修改|调整|edit|modify|adjust/i, 'pencil'], [/层|堆叠|layer|stack/i, 'layers'], [/大脑|思考|认知|brain|think|cognit/i, 'brain'],
];

export function pickIcon(text, fallback = 'circle-dot') {
  const s = String(text || '');
  for (const [re, icon] of KEYWORDS) if (re.test(s)) return icon;
  return fallback;
}

export function hasIcon(name) { return !!ICONS[name]; }
export const ICON_NAMES = Object.keys(ICONS);

function resolveIconName(name) {
  if (!name) return 'circle-dot';
  const n = String(name).toLowerCase().trim().replace(/[_\s]+/g, '-');
  if (ICONS[n]) return n;
  const alt = { check: 'circle-check', 'check-circle': 'circle-check', 'alert-triangle': 'triangle-alert', 'bar-chart': 'chart-column', 'line-chart': 'chart-line', 'pie-chart': 'chart-pie', chart: 'chart-column', 'help-circle': 'circle-help', 'x-circle': 'circle-x', 'play-circle': 'circle-play', 'trending': 'trending-up', ai: 'sparkles', money: 'banknote', dollar: 'dollar-sign', person: 'user', people: 'users', team: 'users', world: 'globe', earth: 'earth', idea: 'lightbulb', security: 'shield-check', speed: 'zap', time: 'clock', settings2: 'settings', home: 'house', 'edit': 'pencil', magic: 'wand-sparkles', 'wand-2': 'wand-sparkles' }[n];
  if (alt && ICONS[alt]) return alt;
  const pref = ICON_NAMES.find((k) => k.startsWith(n + '-') || k.endsWith('-' + n));
  return pref || pickIcon(n);
}

function iconEntry(name) {
  const n = resolveIconName(name);
  let e = iconCache.get(n);
  if (!e) {
    const parts = (ICONS[n] || ICONS['circle-dot']).split('|');
    e = { name: n, paths: parts.map((d) => new Path2D(d)), d: parts, lens: null };
    iconCache.set(n, e);
  }
  return e;
}

function pathLengths(e) {
  if (e.lens) return e.lens;
  try {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    e.lens = e.d.map((d) => { el.setAttribute('d', d); return el.getTotalLength() || 30; });
  } catch {
    e.lens = e.d.map(() => 40);
  }
  return e.lens;
}

/** Draw a 24-grid lucide icon centered at (cx,cy) with given size. draw=0..1 progressive stroke. */
export function drawIcon(ctx, name, cx, cy, size, color, o = {}) {
  const e = iconEntry(name);
  const s = size / 24;
  ctx.save();
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(s, s);
  ctx.strokeStyle = color;
  ctx.lineWidth = o.stroke ?? 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const draw = o.draw ?? 1;
  if (draw >= 1) {
    for (const p of e.paths) ctx.stroke(p);
  } else if (draw > 0) {
    const lens = pathLengths(e);
    const total = lens.reduce((a, b) => a + b, 0);
    let budget = total * draw;
    e.paths.forEach((p, i) => {
      if (budget <= 0) return;
      const L = lens[i];
      const part = Math.min(L, budget);
      budget -= L;
      ctx.setLineDash([part, L + 1]);
      ctx.lineDashOffset = 0;
      ctx.stroke(p);
    });
  }
  ctx.restore();
}

// ───────────────────────────── numbers ─────────────────────────────
export function formatNumber(v, o = {}) {
  if (v == null || !Number.isFinite(v)) return String(v ?? '');
  const dec = o.decimals ?? (Math.abs(v) < 10 && v % 1 ? 1 : 0);
  const fixed = Math.abs(v).toFixed(dec);
  const [i, f] = fixed.split('.');
  const grouped = o.grouping === false || i.length <= 4 ? i : i.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (v < 0 ? '−' : '') + grouped + (f ? '.' + f : '');
}

/** Decimal places implied by a value (for count-up formatting). */
export const decimalsOf = (v) => { const s = String(v); const i = s.indexOf('.'); return i < 0 ? 0 : Math.min(3, s.length - i - 1); };

/**
 * Draw a number string with tabular digits (each digit gets the max digit advance)
 * so counting animations don't jitter. Returns total width.
 */
export function numberWidth(te, str, font, tracking = 0) {
  const dw = digitAdvance(te, font, tracking);
  let w = 0;
  for (const ch of str) w += /\d/.test(ch) ? dw : te.width(ch, font, tracking);
  return w;
}
const digitCache = new Map();
function digitAdvance(te, font, tracking) {
  const k = font + tracking;
  let v = digitCache.get(k);
  if (v == null) { v = Math.max(...'0123456789'.split('').map((d) => te.width(d, font, tracking))); digitCache.set(k, v); }
  return v;
}
export function drawTabular(ctx, te, str, x, y, font, tracking = 0) {
  const dw = digitAdvance(te, font, tracking);
  ctx.font = font;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${tracking}px`;
  let cx = x;
  for (const ch of str) {
    if (/\d/.test(ch)) {
      const w = te.width(ch, font, tracking);
      ctx.fillText(ch, cx + (dw - w) / 2, y);
      cx += dw;
    } else {
      ctx.fillText(ch, cx, y);
      cx += te.width(ch, font, tracking);
    }
  }
  return cx - x;
}

// ───────────────────────────── misc drawing ─────────────────────────────
export function line(ctx, x1, y1, x2, y2) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }

export function dashed(ctx, on, gap) { ctx.setLineDash([on, gap]); }

export function softShadow(ctx, p, env, k = 1) {
  ctx.shadowColor = p.shadow;
  ctx.shadowBlur = 24 * env.unit * k;
  ctx.shadowOffsetY = 8 * env.unit * k;
}

export function textColorOn(bg) { return isDark(bg) ? '#ffffff' : '#111111'; }

export { mix, toCss };
