// Rule-based reporting of the classic learner consonant substitutions, applied on top
// of the calibrated phone scores (see the comment in assess.ts).
import { stripStress } from './phones.ts';

/**
 * Consonant substitutions typical of Chinese learners that are phonemic rather than
 * connected-speech variants (voicing-only pairs and assimilation such as "in the" → /n/
 * are left to the calibrated score).
 */
export const SALIENT_SUBS = new Set(['TH>S', 'TH>F', 'TH>T', 'DH>Z', 'DH>D', 'V>W', 'V>B', 'W>V', 'N>L', 'L>N', 'R>L', 'R>W', 'NG>N', 'N>NG', 'SH>S', 'S>SH', 'CH>SH']);
/** Highest phone score (0–2 scale) for such a substitution: the "fair" band. */
export const SALIENT_SUB_CAP = 1.58;
/** Highest word score (0–10 scale) for a word containing such a substitution. */
export const SALIENT_SUB_WORD_CAP = 7.9;

/** Canonical phone before (dir -1) or after (dir 1) a phone, across word boundaries when the neighbouring word was read. */
export function neighbourPhone(words: Array<{ skipped: boolean; phones: Array<{ arpa: string }> }>, wi: number, pi: number, dir: -1 | 1): string {
  const ph = words[wi].phones[pi + dir];
  if (ph) return stripStress(ph.arpa);
  const w = words[wi + dir];
  if (!w || w.skipped || !w.phones.length) return '';
  return stripStress(w.phones[dir === 1 ? 0 : w.phones.length - 1].arpa);
}

/**
 * 'both': the frame classifier and the CTC recognizer independently prefer the same
 * substitute; 'ctc': the CTC recognizer alone prefers it by a wide margin (the frame
 * classifier leans on word context and often hears the expected phone regardless).
 */
export function salientSubstitution(expected: string, heard: string, fcComp: string, fcLpr: number, ctcGop: number, prevPhone: string, nextPhone: string): 'both' | 'ctc' | null {
  const pair = `${expected}>${heard}`;
  if (!SALIENT_SUBS.has(pair)) return null;
  // connected-speech assimilation that native speakers produce too ("in case", "in London", "is the", "and the")
  if (pair === 'N>NG' && (nextPhone === 'K' || nextPhone === 'G')) return null;
  if (pair === 'L>N' && prevPhone === 'N') return null;
  if (pair === 'N>L' && nextPhone === 'L') return null;
  if (pair === 'DH>Z' && (prevPhone === 'S' || prevPhone === 'Z')) return null;
  if (pair === 'DH>D' && (prevPhone === 'N' || prevPhone === 'T' || prevPhone === 'D')) return null;
  if (fcComp === heard && fcLpr < -3 && ctcGop < -1) return 'both';
  return ctcGop < -3 ? 'ctc' : null;
}
