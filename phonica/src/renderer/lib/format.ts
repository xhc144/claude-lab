export type Rating = 'good' | 'fair' | 'poor' | 'missing';

export function rate(score: number | null | undefined, missing = false): Rating {
  if (missing) return 'missing';
  if (score === null || score === undefined) return 'missing';
  return score >= 80 ? 'good' : score >= 60 ? 'fair' : 'poor';
}

export function phoneRate(score: number): Rating {
  return score >= 80 ? 'good' : score >= 60 ? 'fair' : 'poor';
}

export function scoreColor(score: number | null | undefined): string {
  const r = rate(score);
  return `var(--${r === 'missing' ? 'missing' : r})`;
}

export function fmtTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(sec < 60 ? 1 : 0)}`;
}

export function fmtClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (d.toDateString() === now.toDateString()) return `今天 ${hm}`;
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return `昨天 ${hm}`;
  return `${d.getFullYear() === now.getFullYear() ? '' : d.getFullYear() + '/'}${d.getMonth() + 1}/${d.getDate()} ${hm}`;
}

export const MODE_LABEL: Record<string, string> = { word: '单词', sentence: '句子', passage: '文章' };

export function guessMode(text: string): 'word' | 'sentence' | 'passage' {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const sentences = (text.match(/[.!?](\s|$)/g) ?? []).length;
  if (words <= 2) return 'word';
  if (words <= 40 && sentences <= 2) return 'sentence';
  return 'passage';
}

export function uid(): string {
  return crypto.randomUUID();
}
