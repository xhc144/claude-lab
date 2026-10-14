// Spectrogram, vowel chart, live input waveform and score trend chart.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { AssessmentResult } from '../../shared/types.ts';
import { spectrogram, player } from '../lib/audio.ts';
import { phoneRate } from '../lib/format.ts';

function cssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function useWidth(ref: React.RefObject<HTMLElement | null>) {
  const [w, setW] = useState(600);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

// magma-like colour map
const STOPS: Array<[number, number, number]> = [[0, 0, 4], [28, 16, 68], [79, 18, 123], [129, 37, 129], [181, 54, 122], [229, 80, 100], [251, 135, 97], [254, 194, 135], [252, 253, 191]];
function cmap(v: number): [number, number, number] {
  const x = Math.max(0, Math.min(1, v)) * (STOPS.length - 1);
  const i = Math.floor(x);
  const f = x - i;
  const a = STOPS[i];
  const b = STOPS[Math.min(STOPS.length - 1, i + 1)];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

export function Spectrogram({ result, buffer, audioUrl, tag, maxHz, dynRange, showFormants, zoom }: { result: AssessmentResult; buffer: AudioBuffer | null; audioUrl: string; tag: string; maxHz: number; dynRange: number; showFormants: boolean; zoom: number }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const width = useWidth(wrap);
  const H = 300;
  const dur = result.audio.durationSec;
  const contentW = Math.max(width, zoom > 0 ? Math.ceil(dur * zoom) : width);
  const spec = useMemo(() => (buffer ? spectrogram(buffer, 0.005, 0.025, 8000) : null), [buffer]);
  const img = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!spec) return;
    const { data, frames, bins } = spec;
    let mx = -200;
    for (let i = 0; i < data.length; i++) if (data[i] > mx) mx = data[i];
    const lo = mx - dynRange;
    const showBins = Math.max(2, Math.round((Math.min(maxHz, spec.maxHz) / spec.maxHz) * bins));
    const c = document.createElement('canvas');
    c.width = frames;
    c.height = showBins;
    const g = c.getContext('2d')!;
    const im = g.createImageData(frames, showBins);
    for (let f = 0; f < frames; f++) {
      for (let k = 0; k < showBins; k++) {
        const v = (data[f * bins + k] - lo) / dynRange;
        const [r, gg, b] = cmap(v);
        const o = ((showBins - 1 - k) * frames + f) * 4;
        im.data[o] = r; im.data[o + 1] = gg; im.data[o + 2] = b; im.data[o + 3] = 255;
      }
    }
    g.putImageData(im, 0, 0);
    img.current = c;
  }, [spec, maxHz, dynRange]);

  useEffect(() => {
    const draw = () => {
      const c = canvas.current;
      if (!c || !img.current) return;
      const dpr = window.devicePixelRatio || 1;
      c.width = Math.floor(contentW * dpr);
      c.height = Math.floor((H + 40) * dpr);
      c.style.width = `${contentW}px`;
      c.style.height = `${H + 40}px`;
      const g = c.getContext('2d')!;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.imageSmoothingEnabled = true;
      const used = (spec!.frames * spec!.hop) / dur;
      g.drawImage(img.current, 0, 0, contentW * used, H);
      const pps = contentW / dur;
      const font = getComputedStyle(document.body).fontFamily;
      // frequency grid
      g.fillStyle = 'rgba(255,255,255,0.75)';
      g.font = `10px ${font}`;
      for (let hz = 1000; hz < maxHz; hz += 1000) {
        const y = H - (hz / maxHz) * H;
        g.fillRect(0, y, 6, 1);
        g.fillText(`${hz / 1000}k`, 8, y + 3);
      }
      // formant markers for analysed vowels
      if (showFormants) {
        for (const v of result.vowels) {
          const ph = result.words[v.word]?.phones[v.phone];
          if (!ph) continue;
          const x0 = ph.start * pps;
          const x1 = ph.end * pps;
          for (const [f, colr] of [[v.f1, '#7dd3fc'], [v.f2, '#a7f3d0']] as const) {
            if (f > maxHz) continue;
            const y = H - (f / maxHz) * H;
            g.strokeStyle = colr;
            g.lineWidth = 2;
            g.beginPath();
            g.moveTo(x0, y);
            g.lineTo(x1, y);
            g.stroke();
          }
        }
      }
      // word labels under the image
      g.font = `600 12px ${font}`;
      g.textAlign = 'center';
      for (const w of result.words) {
        if (w.skipped) continue;
        const x0 = w.start * pps;
        const x1 = w.end * pps;
        g.fillStyle = 'rgba(255,255,255,0.35)';
        g.fillRect(x0, 0, 1, H);
        const r = phoneRate(w.score);
        g.fillStyle = r === 'good' ? cssVar('--text-2') : r === 'fair' ? cssVar('--fair') : cssVar('--poor');
        g.fillText(w.text, (x0 + x1) / 2, H + 16);
        g.font = `11px ${cssVar('--font-ipa')}`;
        g.fillStyle = cssVar('--text-3');
        const ipas = w.phones.map((p) => p.ipa).join('');
        g.fillText(ipas, (x0 + x1) / 2, H + 32);
        g.font = `600 12px ${font}`;
      }
      if (player.src === audioUrl && player.tag.startsWith(tag)) {
        g.fillStyle = '#fff';
        g.fillRect(player.time * pps - 1, 0, 2, H);
      }
    };
    draw();
    return player.on(draw);
  });

  const onClick = (e: React.MouseEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const t = ((e.clientX - r.left) / contentW) * dur;
    void player.play(audioUrl, { tag, start: t });
  };

  return (
    <div className="timeline-scroll" ref={wrap} style={{ background: '#000' }}>
      <canvas ref={canvas} onClick={onClick} style={{ cursor: 'pointer', display: 'block' }} />
    </div>
  );
}

// Hillenbrand et al. (1995) average American English vowel formants (Hz)
const REF: Record<'male' | 'female', Record<string, [number, number]>> = {
  male: { IY: [342, 2322], IH: [427, 2034], EY: [476, 2089], EH: [580, 1799], AE: [588, 1952], AA: [768, 1333], AO: [652, 997], OW: [497, 910], UH: [469, 1122], UW: [378, 997], AH: [623, 1200], ER: [474, 1379] },
  female: { IY: [437, 2761], IH: [483, 2365], EY: [536, 2530], EH: [731, 2058], AE: [669, 2349], AA: [936, 1551], AO: [781, 1136], OW: [555, 1035], UH: [519, 1225], UW: [459, 1105], AH: [753, 1426], ER: [523, 1588] },
};
const VIPA: Record<string, string> = { IY: 'iː', IH: 'ɪ', EY: 'eɪ', EH: 'e', AE: 'æ', AA: 'ɑː', AO: 'ɔː', OW: 'oʊ', UH: 'ʊ', UW: 'uː', AH: 'ʌ', ER: 'ɜː' };

export function VowelChart({ result, onPick }: { result: AssessmentResult; onPick?: (word: number) => void }) {
  const wrap = useRef<HTMLDivElement>(null);
  const width = useWidth(wrap);
  const profile = result.speakerProfile === 'male' ? 'male' : 'female';
  const ref = REF[profile];
  const W = Math.min(width, 720);
  const H = 420;
  const pad = 46;
  const f1r: [number, number] = profile === 'male' ? [250, 950] : [300, 1150];
  const f2r: [number, number] = profile === 'male' ? [700, 2600] : [800, 3100];
  const xOf = (f2: number) => pad + ((f2r[1] - f2) / (f2r[1] - f2r[0])) * (W - pad * 1.5);
  const yOf = (f1: number) => pad / 2 + ((f1 - f1r[0]) / (f1r[1] - f1r[0])) * (H - pad * 1.5);
  const [hover, setHover] = useState<string | null>(null);
  return (
    <div ref={wrap}>
      <svg width={W} height={H} style={{ display: 'block', overflow: 'visible' }}>
        <rect x={pad} y={pad / 2} width={W - pad * 1.5} height={H - pad * 1.5} rx={10} fill="var(--surface-2)" stroke="var(--border)" />
        {[1000, 1500, 2000, 2500, 3000].filter((v) => v > f2r[0] && v < f2r[1]).map((v) => (
          <g key={v}>
            <line x1={xOf(v)} x2={xOf(v)} y1={pad / 2} y2={H - pad} stroke="var(--chart-grid)" />
            <text x={xOf(v)} y={H - pad + 16} fontSize={11} textAnchor="middle" fill="var(--text-3)">{v}</text>
          </g>
        ))}
        {[300, 500, 700, 900, 1100].filter((v) => v > f1r[0] && v < f1r[1]).map((v) => (
          <g key={v}>
            <line x1={pad} x2={W - pad / 2} y1={yOf(v)} y2={yOf(v)} stroke="var(--chart-grid)" />
            <text x={pad - 6} y={yOf(v) + 4} fontSize={11} textAnchor="end" fill="var(--text-3)">{v}</text>
          </g>
        ))}
        <text x={W / 2} y={H - 8} fontSize={11.5} textAnchor="middle" fill="var(--text-3)">F2 (Hz) ← 舌位靠前 · 靠后 →</text>
        <text x={12} y={H / 2} fontSize={11.5} textAnchor="middle" fill="var(--text-3)" transform={`rotate(-90 12 ${H / 2})`}>F1 (Hz) 开口度 ↓</text>
        {Object.entries(ref).map(([v, [f1, f2]]) => (
          <g key={v} opacity={0.9}>
            <circle cx={xOf(f2)} cy={yOf(f1)} r={22} fill="var(--accent-soft)" stroke="var(--accent)" strokeOpacity={0.35} />
            <text x={xOf(f2)} y={yOf(f1) + 6} fontSize={17} textAnchor="middle" fill="var(--accent-text)" className="ipa">{VIPA[v]}</text>
          </g>
        ))}
        {result.vowels.map((v, i) => {
          const r = phoneRate(v.score);
          const c = r === 'good' ? 'var(--good)' : r === 'fair' ? 'var(--fair)' : 'var(--poor)';
          const target = ref[v.arpa];
          const key = `${i}`;
          return (
            <g key={key} style={{ cursor: 'pointer' }} onMouseEnter={() => setHover(key)} onMouseLeave={() => setHover(null)} onClick={() => onPick?.(v.word)}>
              {target && hover === key && <line x1={xOf(v.f2)} y1={yOf(v.f1)} x2={xOf(target[1])} y2={yOf(target[0])} stroke={c} strokeDasharray="4 3" />}
              <circle cx={xOf(Math.max(f2r[0], Math.min(f2r[1], v.f2)))} cy={yOf(Math.max(f1r[0], Math.min(f1r[1], v.f1)))} r={hover === key ? 7 : 5} fill={c} stroke="var(--surface)" strokeWidth={1.5} />
              {hover === key && (
                <text x={xOf(v.f2) + 10} y={yOf(v.f1) - 8} fontSize={12} fill="var(--text)">
                  {result.words[v.word].text} /{VIPA[v.arpa] ?? v.arpa}/ F1 {v.f1} F2 {v.f2} · {v.score}分
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="small muted" style={{ marginTop: 8 }}>
        蓝色圆圈为美式英语{profile === 'male' ? '男声' : '女声'}元音平均共振峰（Hillenbrand 等，1995），彩色点为你每个元音的测量值（按得分着色）。点越靠近对应的圆圈，舌位越接近标准；共振峰由 LPC 自动估计，个体差异和录音条件会带来偏差，仅供参考。
      </div>
    </div>
  );
}

export function LiveWave({ data }: { data: number[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth;
    const h = c.clientHeight;
    c.width = w * dpr;
    c.height = h * dpr;
    const g = c.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    const n = Math.floor(w / 3);
    const vals = data.slice(-n);
    g.fillStyle = cssVar('--accent');
    vals.forEach((v, i) => {
      const a = Math.min(1, Math.sqrt(v) * 2.2);
      const bh = Math.max(2, a * (h - 8));
      g.globalAlpha = 0.35 + 0.65 * (i / Math.max(1, vals.length));
      g.fillRect(w - (vals.length - i) * 3, (h - bh) / 2, 2, bh);
    });
    g.globalAlpha = 1;
  }, [data]);
  return <canvas ref={ref} className="live-wave" />;
}

export function TrendChart({ data, height = 200 }: { data: Array<{ date: string; overall: number; accuracy: number; fluency: number; prosody: number; n: number }>; height?: number }) {
  const wrap = useRef<HTMLDivElement>(null);
  const width = useWidth(wrap);
  const [hi, setHi] = useState<number | null>(null);
  const series: Array<[keyof (typeof data)[number], string, string]> = [
    ['overall', '总分', 'var(--accent)'],
    ['accuracy', '准确度', 'var(--good)'],
    ['fluency', '流利度', 'var(--fair)'],
    ['prosody', '韵律', 'var(--pitch-ref)'],
  ];
  if (data.length === 0) return <div ref={wrap} className="empty">完成几次练习后，这里会显示进步曲线</div>;
  const pad = { l: 34, r: 12, t: 12, b: 26 };
  const W = width;
  const xs = (i: number) => pad.l + (data.length === 1 ? (W - pad.l - pad.r) / 2 : (i / (data.length - 1)) * (W - pad.l - pad.r));
  const minY = Math.max(0, Math.min(...data.flatMap((d) => [d.overall, d.accuracy, d.fluency, d.prosody])) - 10);
  const ys = (v: number) => pad.t + ((100 - v) / (100 - minY)) * (height - pad.t - pad.b);
  return (
    <div ref={wrap} style={{ position: 'relative' }}>
      <svg width={W} height={height} onMouseLeave={() => setHi(null)}>
        {[minY, (minY + 100) / 2, 100].map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={ys(v)} y2={ys(v)} stroke="var(--chart-grid)" />
            <text x={pad.l - 6} y={ys(v) + 4} textAnchor="end" fontSize={10.5} fill="var(--text-3)">{Math.round(v)}</text>
          </g>
        ))}
        {series.map(([k, , c]) => (
          <polyline key={String(k)} fill="none" stroke={c} strokeWidth={k === 'overall' ? 2.6 : 1.6} strokeOpacity={k === 'overall' ? 1 : 0.75} points={data.map((d, i) => `${xs(i)},${ys(d[k] as number)}`).join(' ')} />
        ))}
        {data.map((d, i) => (
          <g key={d.date}>
            <rect x={xs(i) - 12} y={pad.t} width={24} height={height - pad.t - pad.b} fill="transparent" onMouseEnter={() => setHi(i)} />
            <circle cx={xs(i)} cy={ys(d.overall)} r={hi === i ? 5 : 3} fill="var(--accent)" />
          </g>
        ))}
        {data.length <= 14
          ? data.map((d, i) => <text key={d.date} x={xs(i)} y={height - 8} fontSize={10.5} textAnchor="middle" fill="var(--text-3)">{d.date.slice(5)}</text>)
          : [0, data.length - 1].map((i) => <text key={i} x={xs(i)} y={height - 8} fontSize={10.5} textAnchor="middle" fill="var(--text-3)">{data[i].date.slice(5)}</text>)}
      </svg>
      {hi !== null && (
        <div className="tooltip" style={{ left: Math.min(xs(hi) + 10, W - 170), top: 6 }}>
          <b>{data[hi].date}</b>（{data[hi].n} 次）<br />
          {series.map(([k, l]) => <span key={String(k)}>{l} {data[hi][k] as number}　</span>)}
        </div>
      )}
      <div className="legend" style={{ marginTop: 4 }}>
        {series.map(([k, l, c]) => <span key={String(k)}><i style={{ background: c }} />{l}</span>)}
      </div>
    </div>
  );
}
