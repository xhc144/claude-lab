// Cuts and speed of a screen recording. The recording is edited as an ordered list of clips,
// each a range of source time played at a speed:
//   clips: [{ id, from, to, speed }]      (seconds into the source file; speed 0.25–8)
// Output time runs through the clips one after another. Zooms, cursor and camera stay in source
// time, so cutting or speeding up a part never breaks the effects of the rest.

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const EPS = 1e-6;
let seq = 0;
const newId = () => `c${Date.now().toString(36)}${(seq++).toString(36)}`;

export const MIN_CLIP = 0.1;

export function normalizeClips(clips, sourceDuration) {
  const D = Number(sourceDuration) || 0;
  const list = (Array.isArray(clips) ? clips : [])
    .map((c) => ({ id: c.id || newId(), from: clamp(Number(c.from) || 0, 0, D || Infinity), to: clamp(Number(c.to ?? D), 0, D || Infinity), speed: clamp(Number(c.speed) || 1, 0.25, 8), ...(c.muted ? { muted: true } : {}) }))
    .filter((c) => c.to - c.from >= MIN_CLIP / 2);
  if (!list.length && D > 0) return [{ id: 'c1', from: 0, to: D, speed: 1 }];
  return list;
}

export const clipLength = (c) => (c.to - c.from) / c.speed;

export function outDuration(clips) {
  return clips.reduce((a, c) => a + clipLength(c), 0);
}

/** Output start of each clip. */
export function clipStarts(clips) {
  const out = [];
  let t = 0;
  for (const c of clips) { out.push(t); t += clipLength(c); }
  return out;
}

/** Output time → { src, index, speed, outStart } (clamped to the ends). */
export function outToSrc(clips, t) {
  if (!clips.length) return { src: Math.max(0, t), index: -1, speed: 1, outStart: 0 };
  let acc = 0;
  for (let i = 0; i < clips.length; i++) {
    const c = clips[i];
    const len = clipLength(c);
    if (t < acc + len - EPS || i === clips.length - 1) {
      const local = clamp(t - acc, 0, len);
      return { src: c.from + local * c.speed, index: i, speed: c.speed, outStart: acc, muted: !!c.muted };
    }
    acc += len;
  }
  const last = clips.at(-1);
  return { src: last.to, index: clips.length - 1, speed: last.speed, outStart: acc - clipLength(last) };
}

/** Source time → output time, or null when that moment was cut away. */
export function srcToOut(clips, s) {
  let acc = 0;
  for (const c of clips) {
    if (s >= c.from - EPS && s <= c.to + EPS) return acc + (clamp(s, c.from, c.to) - c.from) / c.speed;
    acc += clipLength(c);
  }
  return null;
}

/** Output ranges where a source range is visible (a zoom drawn on the output timeline). */
export function srcRangeToOut(clips, s0, s1) {
  const out = [];
  let acc = 0;
  for (const c of clips) {
    const a = Math.max(s0, c.from), b = Math.min(s1, c.to);
    if (b - a > EPS) out.push([acc + (a - c.from) / c.speed, acc + (b - c.from) / c.speed]);
    acc += clipLength(c);
  }
  return out;
}

/** Split the clip under output time t into two. */
export function splitAt(clips, t) {
  const m = outToSrc(clips, t);
  const c = clips[m.index];
  if (!c || m.src - c.from < MIN_CLIP || c.to - m.src < MIN_CLIP) return clips;
  return [...clips.slice(0, m.index), { ...c, to: m.src }, { ...c, id: newId(), from: m.src }, ...clips.slice(m.index + 1)];
}

export function removeClip(clips, index) {
  if (clips.length <= 1) return clips;
  return clips.filter((_, i) => i !== index);
}

/** Cut away the output range [t0, t1] (may span several clips). */
export function cutRange(clips, t0, t1) {
  let list = splitAt(splitAt(clips, Math.min(t0, t1)), Math.max(t0, t1));
  const starts = clipStarts(list);
  const keep = list.filter((c, i) => { const mid = starts[i] + clipLength(c) / 2; return mid < Math.min(t0, t1) || mid > Math.max(t0, t1); });
  return keep.length ? keep : list;
}

export function setSpeed(clips, index, speed) {
  return clips.map((c, i) => (i === index ? { ...c, speed: clamp(Number(speed) || 1, 0.25, 8) } : c));
}

/** Move a clip edge to a new source time (bounded by the source and the clip's other edge). */
export function trimClip(clips, index, edge, src, sourceDuration) {
  return clips.map((c, i) => {
    if (i !== index) return c;
    if (edge === 'from') return { ...c, from: clamp(src, 0, c.to - MIN_CLIP) };
    return { ...c, to: clamp(src, c.from + MIN_CLIP, sourceDuration ?? Infinity) };
  });
}

export function moveClip(clips, from, to) {
  const list = [...clips];
  const [c] = list.splice(from, 1);
  list.splice(clamp(to, 0, list.length), 0, c);
  return list;
}

/**
 * Audio of a source file laid along the output: one entry per clip, for the FFmpeg mixer
 * ({ file, trim: [from, to], start, tempo, volume }).
 */
export function audioSegments(clips, file, { volume = 1, offset = 0 } = {}) {
  const starts = clipStarts(clips);
  return clips.filter((c) => !c.muted).map((c) => ({ file, trim: [c.from, c.to], start: offset + starts[clips.indexOf(c)], tempo: c.speed, volume, loopToEnd: false }));
}
