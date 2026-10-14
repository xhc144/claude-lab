// Local storage of recordings, assessment results, AI analyses and practice
// materials. Everything lives in plain files under the data folder so users can
// back it up or inspect it.
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import type { AssessmentResult, HistoryEntry, Material, AiAnalysis, WeakStats } from '../shared/types.ts';
import { encodeWav } from '../engine/wav.ts';
import { PHONES, phoneIpa, stripStress } from '../engine/phones.ts';

export class Store {
  readonly dir: string;
  private index: HistoryEntry[] | null = null;

  constructor(dir: string) {
    this.dir = dir;
    mkdirSync(join(dir, 'records'), { recursive: true });
    mkdirSync(join(dir, 'cache', 'tts'), { recursive: true });
  }

  private indexFile() {
    return join(this.dir, 'index.json');
  }

  recordDir(id: string) {
    if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error('invalid record id');
    return join(this.dir, 'records', id);
  }

  list(): HistoryEntry[] {
    if (!this.index) {
      try {
        this.index = existsSync(this.indexFile()) ? JSON.parse(readFileSync(this.indexFile(), 'utf8')) : [];
      } catch {
        this.index = this.rebuildIndex();
      }
    }
    return this.index!;
  }

  private saveIndex() {
    const tmp = this.indexFile() + '.tmp';
    writeFileSync(tmp, JSON.stringify(this.index));
    renameSync(tmp, this.indexFile());
  }

  /** Recreate the index from the record folders (used if index.json is damaged). */
  rebuildIndex(): HistoryEntry[] {
    const out: HistoryEntry[] = [];
    const base = join(this.dir, 'records');
    for (const id of existsSync(base) ? readdirSync(base) : []) {
      try {
        const r = JSON.parse(readFileSync(join(base, id, 'result.json'), 'utf8')) as AssessmentResult;
        const meta = existsSync(join(base, id, 'meta.json')) ? JSON.parse(readFileSync(join(base, id, 'meta.json'), 'utf8')) : {};
        out.push(entryFor(r, meta.materialId, meta.favorite));
      } catch {
        /* skip unreadable folders */
      }
    }
    out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    this.index = out;
    this.saveIndex();
    return out;
  }

  save(result: AssessmentResult, samples: Float32Array, sampleRate: number, materialId?: string): HistoryEntry {
    const d = this.recordDir(result.id);
    mkdirSync(join(d, 'ai'), { recursive: true });
    writeFileSync(join(d, 'recording.wav'), encodeWav(samples, sampleRate, 16));
    writeFileSync(join(d, 'result.json'), JSON.stringify(result));
    writeFileSync(join(d, 'meta.json'), JSON.stringify({ materialId: materialId ?? null, favorite: false }));
    const e = entryFor(result, materialId, false);
    this.list().unshift(e);
    this.saveIndex();
    return e;
  }

  get(id: string): { entry: HistoryEntry; result: AssessmentResult; ai: AiAnalysis[] } | null {
    const entry = this.list().find((e) => e.id === id);
    const d = this.recordDir(id);
    if (!entry || !existsSync(join(d, 'result.json'))) return null;
    const result = JSON.parse(readFileSync(join(d, 'result.json'), 'utf8')) as AssessmentResult;
    return { entry, result, ai: this.listAi(id) };
  }

  audioPath(id: string): string {
    return join(this.recordDir(id), 'recording.wav');
  }

  remove(id: string) {
    rmSync(this.recordDir(id), { recursive: true, force: true });
    this.index = this.list().filter((e) => e.id !== id);
    this.saveIndex();
  }

  setFavorite(id: string, favorite: boolean) {
    const e = this.list().find((x) => x.id === id);
    if (!e) return;
    e.favorite = favorite;
    const m = join(this.recordDir(id), 'meta.json');
    const meta = existsSync(m) ? JSON.parse(readFileSync(m, 'utf8')) : {};
    writeFileSync(m, JSON.stringify({ ...meta, favorite }));
    this.saveIndex();
  }

  listAi(id: string): AiAnalysis[] {
    const d = join(this.recordDir(id), 'ai');
    if (!existsSync(d)) return [];
    return readdirSync(d)
      .filter((f) => f.endsWith('.json'))
      .map((f) => JSON.parse(readFileSync(join(d, f), 'utf8')) as AiAnalysis)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  saveAi(id: string, a: AiAnalysis) {
    const d = join(this.recordDir(id), 'ai');
    mkdirSync(d, { recursive: true });
    writeFileSync(join(d, `${a.id}.json`), JSON.stringify(a));
    const e = this.list().find((x) => x.id === id);
    if (e) {
      e.aiCount = (e.aiCount ?? 0) + 1;
      this.saveIndex();
    }
  }

  deleteAi(id: string, aiId: string) {
    if (!/^[0-9a-f-]{36}$/.test(aiId)) return;
    rmSync(join(this.recordDir(id), 'ai', `${aiId}.json`), { force: true });
    const e = this.list().find((x) => x.id === id);
    if (e) {
      e.aiCount = Math.max(0, (e.aiCount ?? 1) - 1);
      this.saveIndex();
    }
  }

  // ---------- materials ----------
  private materialsFile() {
    return join(this.dir, 'materials.json');
  }

  listMaterials(): Material[] {
    try {
      return existsSync(this.materialsFile()) ? JSON.parse(readFileSync(this.materialsFile(), 'utf8')) : [];
    } catch {
      return [];
    }
  }

  saveMaterial(m: Material): Material[] {
    const all = this.listMaterials().filter((x) => x.id !== m.id);
    all.unshift({ ...m, builtin: false, createdAt: m.createdAt ?? new Date().toISOString() });
    writeFileSync(this.materialsFile(), JSON.stringify(all, null, 1));
    return all;
  }

  deleteMaterial(id: string): Material[] {
    const all = this.listMaterials().filter((x) => x.id !== id);
    writeFileSync(this.materialsFile(), JSON.stringify(all, null, 1));
    return all;
  }

  // ---------- statistics ----------
  weakStats(): WeakStats {
    const entries = this.list();
    const ph = new Map<string, { total: number; bad: number; sum: number }>();
    const words = new Map<string, { count: number; sum: number; last: string; pattern: string }>();
    let seconds = 0;
    const days = new Map<string, { o: number; a: number; f: number; p: number; n: number }>();
    for (const e of entries) {
      seconds += e.durationSec;
      for (const [p, [n, bad, sum]] of Object.entries(e.phoneStats ?? {})) {
        const s = ph.get(p) ?? { total: 0, bad: 0, sum: 0 };
        s.total += n;
        s.bad += bad;
        s.sum += sum;
        ph.set(p, s);
      }
      for (const [w, score, pattern] of e.weakWords ?? []) {
        const s = words.get(w) ?? { count: 0, sum: 0, last: e.createdAt, pattern };
        s.count++;
        s.sum += score;
        if (e.createdAt > s.last) { s.last = e.createdAt; s.pattern = pattern; }
        words.set(w, s);
      }
      const day = e.createdAt.slice(0, 10);
      const d = days.get(day) ?? { o: 0, a: 0, f: 0, p: 0, n: 0 };
      d.o += e.scores.overall;
      d.a += e.scores.accuracy;
      d.f += e.scores.fluency;
      d.p += e.scores.prosody;
      d.n++;
      days.set(day, d);
    }
    return {
      phones: [...ph.entries()]
        .filter(([p]) => PHONES[p])
        .map(([arpa, s]) => ({ arpa, ipa: phoneIpa(arpa + '1', 'us'), total: s.total, bad: s.bad, avg: Math.round(s.sum / Math.max(1, s.total)), rate: s.bad / Math.max(1, s.total) }))
        .sort((a, b) => b.rate - a.rate || a.avg - b.avg),
      words: [...words.entries()]
        .map(([word, s]) => ({ word, count: s.count, avg: Math.round(s.sum / s.count), lastSeen: s.last, pattern: s.pattern }))
        .sort((a, b) => b.count - a.count || a.avg - b.avg)
        .slice(0, 200),
      totalRecords: entries.length,
      totalMinutes: Math.round(seconds / 6) / 10,
      trend: [...days.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, d]) => ({ date, overall: Math.round(d.o / d.n), accuracy: Math.round(d.a / d.n), fluency: Math.round(d.f / d.n), prosody: Math.round(d.p / d.n), n: d.n })),
    };
  }
}

export function entryFor(r: AssessmentResult, materialId?: string, favorite?: boolean): HistoryEntry {
  const phoneStats: Record<string, [number, number, number]> = {};
  const weakWords: Array<[string, number, string]> = [];
  for (const w of r.words) {
    for (const p of w.phones) {
      const b = stripStress(p.arpa);
      const s = phoneStats[b] ?? [0, 0, 0];
      s[0]++;
      if (p.rating === 'poor' || p.rating === 'missing') s[1]++;
      s[2] += p.score;
      phoneStats[b] = s;
    }
    if (w.score < 70) {
      const worst = [...w.phones].sort((a, b) => a.score - b.score)[0];
      const pattern = worst ? `${stripStress(worst.arpa)}${worst.error?.heard ? '>' + worst.error.heard : worst.error ? '>' + worst.error.type : ''}` : '';
      weakWords.push([w.spoken, w.score, pattern]);
    }
  }
  return {
    id: r.id,
    createdAt: r.createdAt,
    text: r.text,
    mode: r.mode,
    accent: r.accent,
    durationSec: r.audio.durationSec,
    scores: r.scores,
    wordCount: r.words.length,
    materialId,
    favorite: !!favorite,
    aiCount: 0,
    phoneStats,
    weakWords,
  };
}
