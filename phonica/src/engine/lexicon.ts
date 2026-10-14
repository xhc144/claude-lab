// Pronunciation lexicon: CMUdict (all variants), British variants (espeak-ng RP +
// non-rhotic derivation), and a neural G2P for out-of-vocabulary words.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { G2p } from 'charsiu-js/core';
import { espeakToArpa, isVowel, stripStress } from './phones.ts';
import { loadPhonemizer } from './espeak.ts';

export type Accent = 'us' | 'uk';

export interface Pron {
  phones: string[]; // stress-marked ARPABET
  source: 'cmudict' | 'uk-derived' | 'espeak-uk' | 'espeak-us' | 'g2p';
  accent: Accent | 'both';
}

type Espeak = (text: string, lang: string) => Promise<string[]>;

export class Lexicon {
  private dict = new Map<string, string[][]>();
  private g2p: G2p | null = null;
  private espeak: Espeak | null = null;
  private espeakCache = new Map<string, string>();

  constructor(private dir: string) {
    const raw = readFileSync(join(dir, 'cmudict.dict'), 'utf8');
    for (const line of raw.split('\n')) {
      if (!line || line.startsWith(';;;')) continue;
      const hash = line.indexOf('#');
      const body = (hash >= 0 ? line.slice(0, hash) : line).trim();
      const sp = body.indexOf(' ');
      if (sp < 0) continue;
      const word = body.slice(0, sp).replace(/\(\d+\)$/, '');
      const phones = body.slice(sp + 1).trim().split(/\s+/);
      const list = this.dict.get(word);
      if (list) list.push(phones);
      else this.dict.set(word, [phones]);
    }
  }

  private loadG2p(): G2p {
    if (!this.g2p) {
      const rj = (n: string) => JSON.parse(readFileSync(join(this.dir, n), 'utf8'));
      const bin = readFileSync(join(this.dir, 'g2p_gru.bin'));
      const data = new Float32Array(bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength));
      this.g2p = new G2p({ cmudict: {}, homographs: rj('homographs.json'), vocab: rj('g2p_vocab.json'), gru: { manifest: rj('g2p_gru.json'), data } });
    }
    return this.g2p;
  }

  async loadEspeak(): Promise<void> {
    if (this.espeak) return;
    try {
      this.espeak = await loadPhonemizer();
    } catch {
      this.espeak = null;
    }
  }

  has(word: string): boolean {
    return this.dict.has(word.toLowerCase());
  }

  /** Raw espeak-ng IPA for a word ('' if espeak is unavailable). */
  async espeakIpa(word: string, accent: Accent): Promise<string> {
    const key = accent + ':' + word;
    const hit = this.espeakCache.get(key);
    if (hit !== undefined) return hit;
    let ipa = '';
    if (this.espeak) {
      try {
        const r = await this.espeak(word, accent === 'uk' ? 'en-gb-x-rp' : 'en-us');
        ipa = r.join(' ').trim();
      } catch {
        ipa = '';
      }
    }
    this.espeakCache.set(key, ipa);
    return ipa;
  }

  private lookup(word: string): string[][] | undefined {
    const w = word.toLowerCase();
    const direct = this.dict.get(w);
    if (direct) return direct;
    // possessive / contraction fallbacks: dog's -> dog + Z
    const m = /^(.+)'s$/.exec(w);
    if (m) {
      const base = this.dict.get(m[1]);
      if (base) {
        return base.map((p) => {
          const last = stripStress(p[p.length - 1]);
          if (['S', 'Z', 'SH', 'ZH', 'CH', 'JH'].includes(last)) return [...p, 'IH0', 'Z'];
          if (['P', 'T', 'K', 'F', 'TH'].includes(last)) return [...p, 'S'];
          return [...p, 'Z'];
        });
      }
    }
    if (w.endsWith("'")) return this.dict.get(w.slice(0, -1));
    return undefined;
  }

  /**
   * All acceptable pronunciations for a spoken word, target accent first.
   * Variants of the other accent are returned too (flagged) so that a learner
   * using a legitimate accent is not marked wrong.
   */
  async prons(word: string, accent: Accent): Promise<Pron[]> {
    const w = word.toLowerCase();
    const out: Pron[] = [];
    const seen = new Set<string>();
    const add = (phones: string[], source: Pron['source'], acc: Pron['accent']) => {
      if (!phones.length) return;
      const k = phones.map(stripStress).join(' ');
      if (seen.has(k)) return;
      seen.add(k);
      out.push({ phones, source, accent: acc });
    };
    const cmu = this.lookup(w);
    const ukIpa = await this.espeakIpa(w, 'uk');
    const ukArpa = ukIpa ? espeakToArpa(ukIpa.split(/\s+/).join('')) : [];

    if (cmu) {
      for (const p of cmu) {
        const nr = nonRhotic(p);
        const rhotic = nr.join(' ') !== p.join(' ');
        if (accent === 'uk' && ukArpa.length) add(ukArpa, 'espeak-uk', 'uk');
        if (accent === 'uk' && rhotic) add(nr, 'uk-derived', 'uk');
        add(p, 'cmudict', rhotic ? 'us' : 'both');
        if (accent === 'us' && rhotic) add(nr, 'uk-derived', 'uk');
      }
      if (accent === 'us' && ukArpa.length) add(ukArpa, 'espeak-uk', 'uk');
    } else {
      // out of vocabulary: espeak (accent-specific) + neural G2P
      const usIpa = await this.espeakIpa(w, 'us');
      const usArpa = usIpa ? espeakToArpa(usIpa.split(/\s+/).join('')) : [];
      const g = this.loadG2p().predict(w.replace(/[^a-z']/g, ''));
      if (accent === 'uk' && ukArpa.length) add(ukArpa, 'espeak-uk', 'uk');
      add(g, 'g2p', 'both');
      if (usArpa.length) add(usArpa, 'espeak-us', 'us');
      if (accent === 'us' && ukArpa.length) add(ukArpa, 'espeak-uk', 'uk');
    }
    return out;
  }
}

/** British (non-rhotic) form of an American pronunciation: /r/ only before a vowel. */
export function nonRhotic(phones: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < phones.length; i++) {
    const p = phones[i];
    const base = stripStress(p);
    if (base === 'R') {
      const next = phones[i + 1];
      if (!next || !isVowel(next)) continue;
    }
    if (base === 'ER' && p.endsWith('0')) {
      const next = phones[i + 1];
      if (!next || !isVowel(next)) { out.push('AH0'); continue; }
    }
    out.push(p);
  }
  return out;
}
