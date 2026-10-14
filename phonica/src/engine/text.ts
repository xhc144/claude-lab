// Reference-text processing: tokens with character offsets (for highlighting),
// sentence segmentation and expansion of numbers/abbreviations into the words
// that are actually spoken.
import { normalizeNumbers } from 'charsiu-js/core';

export interface TextToken {
  index: number;
  /** text as shown */
  text: string;
  start: number;
  end: number;
  /** lower-cased spoken words this token expands to ("25" -> twenty, five) */
  spoken: string[];
  /** punctuation directly following the token (".", ",", "?", "!", ";", ":", "—" …) */
  punctAfter: string;
  sentence: number;
}

export interface Sentence {
  index: number;
  start: number;
  end: number;
  text: string;
  tokenStart: number;
  tokenEnd: number; // exclusive
  type: 'statement' | 'wh-question' | 'yes-no-question' | 'exclamation' | 'fragment';
}

const ABBREV: Record<string, string[]> = {
  'mr.': ['mister'], 'mrs.': ['missus'], 'ms.': ['miz'], 'dr.': ['doctor'], 'st.': ['saint'], 'prof.': ['professor'],
  'jr.': ['junior'], 'sr.': ['senior'], 'vs.': ['versus'], 'etc.': ['et', 'cetera'], 'e.g.': ['for', 'example'], 'i.e.': ['that', 'is'],
  'a.m.': ['a', 'm'], 'p.m.': ['p', 'm'], 'no.': ['number'], 'mt.': ['mount'], 'u.s.': ['u', 's'], 'u.k.': ['u', 'k'],
};

const WH = new Set(['what', 'where', 'when', 'why', 'who', 'whom', 'whose', 'which', 'how']);
const AUX = new Set(['do', 'does', 'did', 'is', 'are', 'am', 'was', 'were', 'can', 'could', 'will', 'would', 'shall', 'should', 'may', 'might', 'must', 'have', 'has', 'had', "isn't", "aren't", "don't", "doesn't", "didn't", "can't", "couldn't", "won't", "wouldn't", "haven't", "hasn't", "wasn't", "weren't", "shouldn't"]);

export function normalizeApostrophes(s: string): string {
  return s.replace(/[‘’ʼ`´]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '—');
}

function spokenForm(raw: string): string[] {
  const lower = raw.toLowerCase();
  if (ABBREV[lower]) return ABBREV[lower];
  if (/\d/.test(lower)) {
    let t = lower.replace(/%$/, ' percent');
    t = normalizeNumbers(t);
    return t.replace(/-/g, ' ').split(/\s+/).map((w) => w.replace(/[^a-z']/g, '')).filter(Boolean);
  }
  // hyphenated compounds are pronounced as their parts
  return lower.split(/-+/).map((w) => w.replace(/^'+|'+$/g, '').replace(/[^a-z']/g, '')).filter(Boolean);
}

export function tokenize(input: string): { tokens: TextToken[]; sentences: Sentence[]; text: string } {
  const text = normalizeApostrophes(input);
  const tokens: TextToken[] = [];
  // words: letters/digits with internal apostrophes, hyphens, periods (abbreviations), %, $ £
  const re = /[$£]?[A-Za-z0-9]+(?:['.\-][A-Za-z0-9]+)*\.?%?|[.,!?;:—()"]/g;
  let m: RegExpExecArray | null;
  const raw: Array<{ s: string; start: number; end: number }> = [];
  while ((m = re.exec(text))) raw.push({ s: m[0], start: m.index, end: m.index + m[0].length });

  let sentence = 0;
  for (let i = 0; i < raw.length; i++) {
    const r = raw[i];
    if (/^[.,!?;:—()"]$/.test(r.s)) {
      const prev = tokens[tokens.length - 1];
      if (prev && prev.sentence === sentence && r.s !== '(' && r.s !== '"') prev.punctAfter += r.s;
      if (/[.!?]/.test(r.s) && prev) sentence++;
      continue;
    }
    let s = r.s;
    let end = r.end;
    let trailingDot = false;
    // a trailing period belongs to the word only for known abbreviations
    if (s.endsWith('.') && !ABBREV[s.toLowerCase()]) {
      s = s.slice(0, -1);
      end -= 1;
      trailingDot = true;
    }
    const spoken = spokenForm(s);
    if (spoken.length === 0) continue;
    const tok: TextToken = { index: tokens.length, text: s, start: r.start, end, spoken, punctAfter: trailingDot ? '.' : '', sentence };
    tokens.push(tok);
    if (trailingDot) sentence++;
  }

  // compact sentence numbering and build sentence records
  const sentences: Sentence[] = [];
  let curOld = -1;
  for (const t of tokens) {
    if (t.sentence !== curOld) {
      curOld = t.sentence;
      sentences.push({ index: sentences.length, start: t.start, end: t.end, text: '', tokenStart: t.index, tokenEnd: t.index + 1, type: 'fragment' });
    }
    const s = sentences[sentences.length - 1];
    t.sentence = s.index;
    s.end = t.end + t.punctAfter.length;
    s.tokenEnd = t.index + 1;
  }
  for (const s of sentences) {
    s.text = text.slice(s.start, Math.min(text.length, s.end)).trim();
    const first = tokens[s.tokenStart]?.spoken[0] ?? '';
    const last = tokens[s.tokenEnd - 1];
    const punct = last?.punctAfter ?? '';
    if (punct.includes('?')) s.type = WH.has(first) ? 'wh-question' : AUX.has(first) ? 'yes-no-question' : 'yes-no-question';
    else if (punct.includes('!')) s.type = 'exclamation';
    else if (punct.includes('.') || s.tokenEnd - s.tokenStart > 3) s.type = 'statement';
  }
  return { tokens, sentences, text };
}

/** Split a passage into practice units (sentences), keeping very short ones together. */
export function splitSentences(input: string): string[] {
  const { sentences, text } = tokenize(input);
  const out: string[] = [];
  for (const s of sentences) {
    const t = text.slice(s.start, s.end).trim();
    if (!t) continue;
    if (out.length && s.tokenEnd - s.tokenStart <= 2 && out[out.length - 1].split(/\s+/).length < 12) out[out.length - 1] += ' ' + t;
    else out.push(t);
  }
  return out;
}

// Function words: normally unstressed and often reduced in connected speech.
export const FUNCTION_WORDS = new Set([
  'a', 'an', 'the', 'and', 'but', 'or', 'nor', 'so', 'yet', 'of', 'to', 'in', 'on', 'at', 'by', 'for', 'from', 'with', 'about', 'as', 'into', 'like', 'through', 'over', 'than', 'up',
  'i', 'me', 'my', 'you', 'your', 'he', 'him', 'his', 'she', 'her', 'it', 'its', 'we', 'us', 'our', 'they', 'them', 'their', 'this', 'that', 'these', 'those',
  'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'shall', 'should', 'can', 'could', 'may', 'might', 'must',
  'there', 'some', 'any', 'if', 'then', 'when', 'who', 'which', 'that', "it's", "i'm", "you're", "we're", "they're", "he's", "she's", "i've", "i'll", "you'll", 'not',
]);
