// Fluency measures derived from the forced alignment: speaking/articulation
// rate, pauses (at phrase boundaries vs. inside phrases), hesitations/fillers
// and mean length of run.

export interface TimedWord {
  index: number;
  text: string;
  start: number; // seconds
  end: number;
  skipped: boolean;
  syllables: number;
  punctAfter: string;
  isFunction: boolean;
}

export interface Pause {
  /** pause sits after word `afterWord` */
  afterWord: number;
  start: number;
  end: number;
  duration: number;
  kind: 'boundary' | 'hesitation' | 'filler';
  /** true when it hurts fluency (long pause inside a phrase, or a filled pause) */
  disfluent: boolean;
}

export interface FluencyStats {
  speechStart: number;
  speechEnd: number;
  speakingTime: number;
  articulationTime: number;
  wordsSpoken: number;
  wordsPerMinute: number;
  syllablesPerSecond: number;
  articulationRate: number;
  pauseCount: number;
  disfluentPauseCount: number;
  longPauseCount: number;
  fillerCount: number;
  fillerTime: number;
  pauseTime: number;
  pauseRatio: number;
  meanLengthOfRun: number;
  longestPause: number;
  pauses: Pause[];
}

export interface GapSpan {
  kind: 'sil' | 'filler';
  start: number;
  end: number;
}

export function fluencyStats(words: TimedWord[], gaps: GapSpan[], minPause = 0.15): FluencyStats {
  const spoken = words.filter((w) => !w.skipped && w.end > w.start);
  if (!spoken.length) {
    return { speechStart: 0, speechEnd: 0, speakingTime: 0, articulationTime: 0, wordsSpoken: 0, wordsPerMinute: 0, syllablesPerSecond: 0, articulationRate: 0, pauseCount: 0, disfluentPauseCount: 0, longPauseCount: 0, fillerCount: 0, fillerTime: 0, pauseTime: 0, pauseRatio: 0, meanLengthOfRun: 0, longestPause: 0, pauses: [] };
  }
  const speechStart = spoken[0].start;
  const speechEnd = spoken[spoken.length - 1].end;
  const speakingTime = Math.max(0.01, speechEnd - speechStart);
  const pauses: Pause[] = [];
  let fillerCount = 0;
  let fillerTime = 0;
  for (const g of gaps) {
    if (g.kind !== 'filler' || g.start < speechStart || g.end > speechEnd) continue;
    if (g.end - g.start >= 0.12) { fillerCount++; fillerTime += g.end - g.start; }
  }
  for (let i = 0; i + 1 < spoken.length; i++) {
    const a = spoken[i];
    const b = spoken[i + 1];
    const dur = b.start - a.end;
    if (dur < minPause) continue;
    const inside = gaps.filter((g) => g.start >= a.end - 0.005 && g.end <= b.start + 0.005);
    const filled = inside.some((g) => g.kind === 'filler' && g.end - g.start >= 0.12);
    const boundary = /[,.;:!?—)]/.test(a.punctAfter);
    const kind: Pause['kind'] = filled ? 'filler' : boundary ? 'boundary' : 'hesitation';
    const disfluent = kind === 'filler' || (kind === 'hesitation' && dur >= 0.3) || dur >= (boundary ? 1.5 : 0.3);
    pauses.push({ afterWord: a.index, start: a.end, end: b.start, duration: dur, kind, disfluent });
  }
  const pauseTime = pauses.reduce((s, p) => s + p.duration, 0);
  const articulationTime = Math.max(0.01, speakingTime - pauseTime);
  const syll = spoken.reduce((s, w) => s + w.syllables, 0);
  // mean length of run: syllables between pauses of >= 0.25 s
  const runs: number[] = [];
  let cur = 0;
  for (let i = 0; i < spoken.length; i++) {
    cur += spoken[i].syllables;
    const p = pauses.find((q) => q.afterWord === spoken[i].index);
    if (p && p.duration >= 0.25) { runs.push(cur); cur = 0; }
  }
  if (cur) runs.push(cur);
  return {
    speechStart,
    speechEnd,
    speakingTime,
    articulationTime,
    wordsSpoken: spoken.length,
    wordsPerMinute: (spoken.length / speakingTime) * 60,
    syllablesPerSecond: syll / speakingTime,
    articulationRate: syll / articulationTime,
    pauseCount: pauses.length,
    disfluentPauseCount: pauses.filter((p) => p.disfluent).length,
    longPauseCount: pauses.filter((p) => p.duration >= 1).length,
    fillerCount,
    fillerTime,
    pauseTime,
    pauseRatio: pauseTime / speakingTime,
    meanLengthOfRun: runs.length ? runs.reduce((a, b) => a + b, 0) / runs.length : 0,
    longestPause: pauses.reduce((m, p) => Math.max(m, p.duration), 0),
    pauses,
  };
}
