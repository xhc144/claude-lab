// Waveform + pitch/energy + word and phone tiers, with playback cursor, hover
// read-outs and click-to-play. Optionally overlays the reference speaker's
// pitch, time-warped onto the learner's words.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { AssessmentResult } from '../../shared/types.ts';
import { peaks, player } from '../lib/audio.ts';
import { phoneRate, rate } from '../lib/format.ts';

export interface RefPitch {
  f0: number[]; // Hz per 10 ms
  words: Array<{ text: string; start: number; end: number }>;
}

interface Props {
  result: AssessmentResult;
  buffer: AudioBuffer | null;
  audioUrl: string;
  tag: string;
  zoom: number; // px per second (0 = fit)
  showPitch: boolean;
  showEnergy: boolean;
  showPhones: boolean;
  reference?: RefPitch | null;
  selected: number | null;
  onSelect: (i: number) => void;
  rateSpeed: number;
}

const H_WAVE = 104;
const H_PITCH = 96;
const H_WORD = 34;
const H_PHONE = 26;
const H_AXIS = 20;

function cssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function Timeline(p: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const staticRef = useRef<HTMLCanvasElement | null>(null);
  const [width, setWidth] = useState(800);
  const [hover, setHover] = useState<{ x: number; y: number; text: string } | null>(null);
  const [, force] = useState(0);
  const dur = p.result.audio.durationSec;
  const lanes = { wave: 0, pitch: H_WAVE, word: H_WAVE + (p.showPitch ? H_PITCH : 0) };
  const phoneY = lanes.word + H_WORD;
  const axisY = phoneY + (p.showPhones ? H_PHONE : 0);
  const height = axisY + H_AXIS;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const contentW = Math.max(width, p.zoom > 0 ? Math.ceil(dur * p.zoom) : width);
  const pxPerSec = contentW / Math.max(0.01, dur);
  const x = (t: number) => t * pxPerSec;

  const pk = useMemo(() => (p.buffer ? peaks(p.buffer, Math.min(20000, Math.max(200, Math.floor(contentW)))) : null), [p.buffer, contentW]);

  // ---------- static layer ----------
  useEffect(() => {
    const dpr = window.devicePixelRatio || 1;
    const c = staticRef.current ?? document.createElement('canvas');
    staticRef.current = c;
    c.width = Math.floor(contentW * dpr);
    c.height = Math.floor(height * dpr);
    const g = c.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, contentW, height);
    const col = {
      grid: cssVar('--chart-grid'), wave: cssVar('--wave'), text3: cssVar('--text-3'),
      good: cssVar('--good'), fair: cssVar('--fair'), poor: cssVar('--poor'), pitch: cssVar('--pitch'), ref: cssVar('--pitch-ref'),
      goodSoft: cssVar('--good-soft'), fairSoft: cssVar('--fair-soft'), poorSoft: cssVar('--poor-soft'), border: cssVar('--border'), surface: cssVar('--surface'),
    };
    const font = getComputedStyle(document.body).fontFamily;

    // shading behind words that need work
    for (const w of p.result.words) {
      if (w.skipped) continue;
      const r = rate(w.score);
      if (r === 'good') continue;
      g.fillStyle = r === 'fair' ? col.fairSoft : col.poorSoft;
      g.fillRect(x(w.start), 0, x(w.end) - x(w.start), H_WAVE);
    }
    // waveform
    if (pk) {
      const n = pk.length / 2;
      const mid = H_WAVE / 2;
      let mx = 0.01;
      for (let i = 0; i < pk.length; i++) mx = Math.max(mx, Math.abs(pk[i]));
      const scale = (H_WAVE / 2 - 6) / mx;
      g.fillStyle = col.wave;
      for (let i = 0; i < n; i++) {
        const xx = (i / n) * contentW;
        const y1 = mid - pk[i * 2 + 1] * scale;
        const y2 = mid - pk[i * 2] * scale;
        g.fillRect(xx, y1, Math.max(1, contentW / n - 0.2), Math.max(1, y2 - y1));
      }
    }
    // pauses
    for (const pa of p.result.fluency.pauses) {
      g.fillStyle = pa.disfluent ? 'rgba(220,38,38,0.10)' : 'rgba(120,130,150,0.10)';
      g.fillRect(x(pa.start), 0, x(pa.end) - x(pa.start), H_WAVE);
      g.fillStyle = pa.disfluent ? col.poor : col.text3;
      g.font = `11px ${font}`;
      g.textAlign = 'center';
      if (x(pa.end) - x(pa.start) > 26) g.fillText(`${pa.duration.toFixed(2)}s`, (x(pa.start) + x(pa.end)) / 2, 14);
    }
    // pitch lane
    if (p.showPitch) {
      const y0 = lanes.pitch;
      g.fillStyle = col.surface;
      g.fillRect(0, y0, contentW, H_PITCH);
      g.strokeStyle = col.grid;
      g.lineWidth = 1;
      const st2y = (st: number) => y0 + H_PITCH / 2 - (st / 12) * (H_PITCH / 2 - 6);
      for (const st of [-12, -6, 0, 6, 12]) {
        g.beginPath();
        g.moveTo(0, st2y(st));
        g.lineTo(contentW, st2y(st));
        g.stroke();
      }
      g.fillStyle = col.text3;
      g.font = `10px ${font}`;
      g.textAlign = 'left';
      g.fillText(`${p.result.prosody.f0MedianHz} Hz`, 4, st2y(0) - 3);
      g.fillText('+12 半音', 4, st2y(12) + 10);
      g.fillText('−12', 4, st2y(-12) - 3);
      const med = p.result.prosody.f0MedianHz || 150;
      const hop = p.result.tracks.hop;
      // energy as a soft area
      if (p.showEnergy) {
        const e = p.result.tracks.energyDb;
        let emax = -120;
        for (const v of e) emax = Math.max(emax, v);
        g.fillStyle = 'rgba(120,130,160,0.16)';
        g.beginPath();
        g.moveTo(0, y0 + H_PITCH);
        for (let i = 0; i < e.length; i++) {
          const v = Math.max(0, (e[i] - (emax - 50)) / 50);
          g.lineTo(x(i * hop), y0 + H_PITCH - v * (H_PITCH - 8));
        }
        g.lineTo(x(e.length * hop), y0 + H_PITCH);
        g.closePath();
        g.fill();
      }
      // reference pitch, warped word by word onto the learner's timeline
      if (p.reference && p.reference.words.length) {
        const ref = p.reference;
        const voiced = ref.f0.filter((v) => v > 0).sort((a, b) => a - b);
        const rmed = voiced[voiced.length >> 1] || med;
        g.strokeStyle = col.ref;
        g.lineWidth = 2;
        g.setLineDash([5, 4]);
        const learner = p.result.words.filter((w) => !w.skipped);
        let wi = 0;
        for (const rw of ref.words) {
          // match words in order by their text
          while (wi < learner.length && learner[wi].text.toLowerCase() !== rw.text.toLowerCase()) wi++;
          if (wi >= learner.length) break;
          const lw = learner[wi++];
          g.beginPath();
          let pen = false;
          for (let t = rw.start; t <= rw.end; t += 0.01) {
            const v = ref.f0[Math.round(t / 0.01)];
            if (!(v > 0)) { pen = false; continue; }
            const tt = lw.start + ((t - rw.start) / Math.max(0.01, rw.end - rw.start)) * (lw.end - lw.start);
            const yy = st2y(Math.max(-12, Math.min(12, 12 * Math.log2(v / rmed))));
            if (!pen) { g.moveTo(x(tt), yy); pen = true; } else g.lineTo(x(tt), yy);
          }
          g.stroke();
        }
        g.setLineDash([]);
      }
      // learner pitch
      const f0 = p.result.tracks.f0;
      g.strokeStyle = col.pitch;
      g.lineWidth = 2.2;
      g.beginPath();
      let pen = false;
      for (let i = 0; i < f0.length; i++) {
        const v = f0[i];
        if (!(v > 0)) { pen = false; continue; }
        const yy = st2y(Math.max(-12, Math.min(12, 12 * Math.log2(v / med))));
        if (!pen) { g.moveTo(x(i * hop), yy); pen = true; } else g.lineTo(x(i * hop), yy);
      }
      g.stroke();
    }
    // word tier
    g.font = `600 13px ${font}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const w of p.result.words) {
      if (w.skipped) continue;
      const r = rate(w.score);
      const c = r === 'good' ? col.good : r === 'fair' ? col.fair : col.poor;
      const x0 = x(w.start);
      const x1 = x(w.end);
      g.fillStyle = r === 'good' ? col.goodSoft : r === 'fair' ? col.fairSoft : col.poorSoft;
      roundRect(g, x0 + 1, lanes.word + 3, Math.max(2, x1 - x0 - 2), H_WORD - 6, 6);
      g.fill();
      if (p.selected === w.index) {
        g.strokeStyle = cssVar('--accent');
        g.lineWidth = 2;
        roundRect(g, x0 + 1, lanes.word + 3, Math.max(2, x1 - x0 - 2), H_WORD - 6, 6);
        g.stroke();
      }
      g.fillStyle = c;
      clipText(g, w.text, (x0 + x1) / 2, lanes.word + H_WORD / 2, x1 - x0 - 4);
    }
    // phone tier
    if (p.showPhones) {
      g.font = `12px ${cssVar('--font-ipa') || font}`;
      for (const w of p.result.words) {
        if (w.skipped) continue;
        for (const ph of w.phones) {
          if (ph.start < 0) continue;
          const r = phoneRate(ph.score);
          const x0 = x(ph.start);
          const x1 = x(ph.end);
          if (r !== 'good') {
            g.fillStyle = r === 'fair' ? col.fairSoft : col.poorSoft;
            g.fillRect(x0, phoneY + 2, x1 - x0, H_PHONE - 4);
          }
          g.strokeStyle = col.border;
          g.lineWidth = 1;
          g.beginPath();
          g.moveTo(x0 + 0.5, phoneY + 4);
          g.lineTo(x0 + 0.5, phoneY + H_PHONE - 4);
          g.stroke();
          g.fillStyle = r === 'good' ? col.text3 : r === 'fair' ? col.fair : col.poor;
          if (x1 - x0 > 7) clipText(g, ph.ipa, (x0 + x1) / 2, phoneY + H_PHONE / 2, x1 - x0 - 1);
        }
      }
    }
    // time axis
    g.fillStyle = col.text3;
    g.font = `10.5px ${font}`;
    g.textAlign = 'left';
    g.textBaseline = 'top';
    const step = pxPerSec > 400 ? 0.1 : pxPerSec > 160 ? 0.25 : pxPerSec > 70 ? 0.5 : pxPerSec > 30 ? 1 : 5;
    for (let t = 0; t <= dur + 1e-6; t += step) {
      const xx = x(t);
      g.fillRect(xx, axisY, 1, 4);
      g.fillText(t >= 60 ? `${Math.floor(t / 60)}:${(t % 60).toFixed(0).padStart(2, '0')}` : `${+t.toFixed(2)}s`, xx + 3, axisY + 4);
    }
    force((v) => v + 1);
  }, [p.result, pk, contentW, height, p.showPitch, p.showEnergy, p.showPhones, p.reference, p.selected, p.zoom]);

  // ---------- compose + playhead ----------
  useEffect(() => {
    const draw = () => {
      const c = canvasRef.current;
      const s = staticRef.current;
      if (!c || !s) return;
      const dpr = window.devicePixelRatio || 1;
      if (c.width !== s.width || c.height !== s.height) {
        c.width = s.width;
        c.height = s.height;
        c.style.width = `${contentW}px`;
        c.style.height = `${height}px`;
      }
      const g = c.getContext('2d')!;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, c.width, c.height);
      g.drawImage(s, 0, 0);
      if (player.src === p.audioUrl && player.tag.startsWith(p.tag)) {
        const xx = x(player.time) * dpr;
        g.fillStyle = cssVar('--accent');
        g.fillRect(xx - dpr, 0, 2 * dpr, c.height);
        // keep the cursor in view while playing
        const wrap = wrapRef.current;
        if (wrap && player.playing) {
          const vx = xx / dpr - wrap.scrollLeft;
          if (vx > wrap.clientWidth - 40 || vx < 0) wrap.scrollLeft = xx / dpr - 60;
        }
      }
    };
    draw();
    return player.on(draw);
  });

  const at = (e: React.MouseEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    return { t: px / pxPerSec, px, py };
  };

  const onMove = (e: React.MouseEvent) => {
    const { t, px, py } = at(e);
    const w = p.result.words.find((w) => !w.skipped && t >= w.start && t <= w.end);
    let text = `${t.toFixed(2)} s`;
    const fi = Math.round(t / p.result.tracks.hop);
    const f0 = p.result.tracks.f0[fi];
    if (py >= phoneY && py < axisY && w) {
      const ph = w.phones.find((q) => t >= q.start && t <= q.end);
      if (ph) text = `/${ph.ipa}/ ${ph.score} 分 · ${(ph.end - ph.start).toFixed(2)} s${ph.error?.heardIpa ? ` · 像 /${ph.error.heardIpa}/` : ''}`;
    } else if (w) {
      text = `${w.text} · ${w.score} 分 · ${t.toFixed(2)} s${f0 > 0 ? ` · ${f0} Hz` : ''}`;
    } else if (f0 > 0) text += ` · ${f0} Hz`;
    setHover({ x: px, y: py, text });
  };

  const onClick = (e: React.MouseEvent) => {
    const { t, py } = at(e);
    const w = p.result.words.find((w) => !w.skipped && t >= w.start - 0.02 && t <= w.end + 0.02);
    if (py >= lanes.word && w) {
      p.onSelect(w.index);
      void player.play(p.audioUrl, { tag: `${p.tag}:w${w.index}`, start: Math.max(0, w.start - 0.03), end: w.end + 0.05, rate: p.rateSpeed });
    } else {
      void player.play(p.audioUrl, { tag: p.tag, start: t, rate: p.rateSpeed });
    }
  };

  return (
    <div className="timeline-scroll" ref={wrapRef}>
      <div className="canvas-wrap" style={{ width: contentW, height }} onMouseMove={onMove} onMouseLeave={() => setHover(null)} onClick={onClick}>
        <canvas ref={canvasRef} style={{ width: contentW, height, cursor: 'pointer' }} />
        {hover && <div className="tooltip" style={{ left: Math.min(hover.x + 12, contentW - 220), top: Math.max(0, hover.y - 30) }}>{hover.text}</div>}
      </div>
    </div>
  );
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function clipText(g: CanvasRenderingContext2D, s: string, cx: number, cy: number, maxW: number) {
  if (maxW < 6) return;
  let t = s;
  while (t.length > 1 && g.measureText(t).width > maxW) t = t.slice(0, -1);
  if (t !== s && t.length > 1) t = t.slice(0, -1) + '…';
  g.fillText(t, cx, cy);
}
