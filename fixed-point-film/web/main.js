// Timeline + compositor. window.renderFrame(t) draws one frame deterministically.
import { W, H, C, FONT, smooth, clamp, balancedWrap } from './lib.js';
import coffee from './scenes/coffee.js';
import title from './scenes/title.js';
import map from './scenes/map.js';
import statement from './scenes/statement.js';
import oned from './scenes/oned.js';
import conditions from './scenes/conditions.js';
import sperner from './scenes/sperner.js';
import proof from './scenes/proof.js';
import apps from './scenes/apps.js';
import closing from './scenes/closing.js';

const MODULES = { coffee, title, map, statement, oned, conditions, sperner, proof, apps, closing };
const params = new URLSearchParams(location.search);
const lang = params.get('lang') || 'en';
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const off = document.createElement('canvas');
off.width = W; off.height = H;
const octx = off.getContext('2d');

let timing, scenes, vignette;

function sceneView(s) {
  const lines = s.lines.map((l) => ({ s: l.start - s.start, e: l.end - s.start }));
  return {
    lang,
    dur: s.end - s.start,
    lines,
    cue: (i) => (lines[i] ? lines[i].s : (i < 0 ? 0 : s.end - s.start)),
    end: (i) => (lines[i] ? lines[i].e : s.end - s.start),
  };
}

function makeVignette() {
  const v = document.createElement('canvas');
  v.width = W; v.height = H;
  const g = v.getContext('2d');
  const grad = g.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 1.05);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.55)');
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  return v;
}

function drawScene(target, s, T) {
  target.save();
  target.setTransform(1, 0, 0, 1, 0, 0);
  target.globalAlpha = 1;
  s.module.draw(target, T - s.start, s.view);
  target.restore();
}

function subtitles(T) {
  const all = timing.scenes.flatMap((s) => s.lines);
  let cur = null, alpha = 0;
  for (let i = 0; i < all.length; i++) {
    const l = all[i];
    const nextStart = all[i + 1] ? all[i + 1].start : Infinity;
    const a = l.start - 0.08, b = Math.min(l.end + 0.35, nextStart - 0.05);
    if (T >= a && T < b) {
      cur = l;
      alpha = Math.min(clamp((T - a) / 0.15), clamp((b - T) / 0.15));
      break;
    }
  }
  if (!cur) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  const primary = lang === 'zh'
    ? { font: `500 44px ${FONT.zh}`, lh: 60 }
    : { font: `400 41px ${FONT.sans}`, lh: 54 };
  ctx.font = primary.font;
  const lines = balancedWrap(ctx, cur.text, lang === 'zh' ? 1500 : 1560);
  let altLines = [];
  if (lang === 'en' && cur.alt) {
    ctx.font = `400 28px ${FONT.zh}`;
    altLines = balancedWrap(ctx, cur.alt, 1500).slice(0, 2);
  }
  const blockH = lines.length * primary.lh + altLines.length * 38 + (altLines.length ? 8 : 0);
  const bottom = 1046;
  const top = bottom - blockH;
  const band = ctx.createLinearGradient(0, top - 70, 0, H);
  band.addColorStop(0, 'rgba(3,5,12,0)');
  band.addColorStop(0.45, 'rgba(3,5,12,0.62)');
  band.addColorStop(1, 'rgba(3,5,12,0.78)');
  ctx.fillStyle = band;
  ctx.fillRect(0, top - 70, W, H - top + 70);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur = 8;
  ctx.font = primary.font;
  ctx.fillStyle = '#f7f8fc';
  let y = top + primary.lh - 14;
  for (const ln of lines) { ctx.fillText(ln, W / 2, y); y += primary.lh; }
  if (altLines.length) {
    ctx.font = `400 28px ${FONT.zh}`;
    ctx.fillStyle = 'rgba(200,210,235,0.82)';
    y += 2 - primary.lh + 42;
    for (const ln of altLines) { ctx.fillText(ln, W / 2, y); y += 38; }
  }
  ctx.restore();
}

window.renderFrame = (T) => {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  const xf = timing.xfade;
  const active = scenes.filter((s) => T >= s.start && T < s.end);
  active.forEach((s, k) => {
    const fadeIn = s.index === 0 ? smooth(T / 1.0) : smooth((T - s.start) / xf);
    if (k === 0 || fadeIn >= 1) {
      drawScene(ctx, s, T);
      if (s.index === 0 && fadeIn < 1) {
        ctx.fillStyle = `rgba(0,0,0,${1 - fadeIn})`;
        ctx.fillRect(0, 0, W, H);
      }
    } else {
      octx.setTransform(1, 0, 0, 1, 0, 0);
      octx.clearRect(0, 0, W, H);
      drawScene(octx, s, T);
      ctx.globalAlpha = fadeIn;
      ctx.drawImage(off, 0, 0);
      ctx.globalAlpha = 1;
    }
  });
  ctx.drawImage(vignette, 0, 0);
  subtitles(T);
  const tailFade = clamp((timing.duration - T) / 1.2);
  if (tailFade < 1) {
    ctx.fillStyle = `rgba(0,0,0,${1 - smooth(tailFade)})`;
    ctx.fillRect(0, 0, W, H);
  }
};

async function init() {
  await window.MathJax.startup.promise;
  timing = await (await fetch(`../build/${lang}/timing.json`)).json();
  vignette = makeVignette();
  scenes = timing.scenes.map((s, index) => ({ ...s, index, module: MODULES[s.id], view: sceneView(s) }));
  for (const s of scenes) if (s.module.init) await s.module.init(s.view);

  // Fonts are split by unicode-range; draw everything once so every subset gets requested.
  const text = timing.scenes.flatMap((s) => s.lines.flatMap((l) => [l.text, l.alt])).join(' ');
  const specs = [`500 44px ${FONT.zh}`, `400 28px ${FONT.zh}`, `400 41px ${FONT.sans}`];
  await Promise.all(specs.map((f) => document.fonts.load(f, text)));
  for (let pass = 0; pass < 2; pass++) {
    for (let T = 0; T < timing.duration; T += 0.5) window.renderFrame(T);
    await document.fonts.ready;
  }
  window.DURATION = timing.duration;
  window.READY = true;
  if (params.has('t')) window.renderFrame(parseFloat(params.get('t')));
}

init().catch((e) => { window.INIT_ERROR = String(e && e.stack || e); console.error(e); });
