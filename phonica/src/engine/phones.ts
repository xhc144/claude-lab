// English phoneme inventory (ARPABET, 39 phones) with IPA renderings, articulatory
// features and Chinese articulation guidance. The acoustic model scores ARPABET
// phones; everything shown to the learner goes through this table.

export type PhoneKind = 'vowel' | 'consonant';

export interface PhoneInfo {
  arpa: string;
  ipaUS: string;
  ipaUK: string;
  kind: PhoneKind;
  // consonants
  voiced?: boolean;
  place?: 'bilabial' | 'labiodental' | 'dental' | 'alveolar' | 'postalveolar' | 'palatal' | 'velar' | 'glottal' | 'labiovelar';
  manner?: 'stop' | 'fricative' | 'affricate' | 'nasal' | 'lateral' | 'approximant';
  // vowels
  height?: number; // 0 = open … 3 = close
  backness?: number; // 0 = front … 2 = back
  rounded?: boolean;
  tense?: boolean;
  diphthong?: boolean;
  rhotic?: boolean;
  /** typical duration in fluent read speech (ms), used to normalise durations */
  meanDurMs: number;
  examples: string[];
  nameZh: string;
  tip: string;
}

const P = (p: PhoneInfo) => p;

export const PHONES: Record<string, PhoneInfo> = {
  IY: P({ arpa: 'IY', ipaUS: 'iː', ipaUK: 'iː', kind: 'vowel', height: 3, backness: 0, tense: true, meanDurMs: 100, examples: ['see', 'eat', 'key'], nameZh: '长元音 /iː/', tip: '嘴角向两侧拉开呈微笑状，舌前部抬高接近上颚，舌尖抵下齿，肌肉保持紧张并把音拉长。与 /ɪ/ 的区别主要在舌位更高、更紧，而不只是更长。' }),
  IH: P({ arpa: 'IH', ipaUS: 'ɪ', ipaUK: 'ɪ', kind: 'vowel', height: 2.6, backness: 0.3, tense: false, meanDurMs: 70, examples: ['sit', 'big', 'ship'], nameZh: '短元音 /ɪ/', tip: '嘴巴比 /iː/ 稍张开，舌位略低略靠后，口腔肌肉放松，发音短促。不要读成汉语拼音的 "i"（那更接近 /iː/）。' }),
  EY: P({ arpa: 'EY', ipaUS: 'eɪ', ipaUK: 'eɪ', kind: 'vowel', height: 2, backness: 0, tense: true, diphthong: true, meanDurMs: 125, examples: ['day', 'make', 'rain'], nameZh: '双元音 /eɪ/', tip: '从 /e/ 开始，舌位逐渐向 /ɪ/ 滑动，前重后轻，滑动要完整。避免读成单一的 /e/ 或汉语的 "ei" 过短。' }),
  EH: P({ arpa: 'EH', ipaUS: 'e', ipaUK: 'e', kind: 'vowel', height: 1.6, backness: 0, tense: false, meanDurMs: 90, examples: ['bed', 'head', 'said'], nameZh: '短元音 /e/', tip: '嘴巴半开，嘴角略向两侧，舌尖抵下齿，舌前部稍抬起。比 /æ/ 开口小，比 /ɪ/ 开口大。' }),
  AE: P({ arpa: 'AE', ipaUS: 'æ', ipaUK: 'æ', kind: 'vowel', height: 0.6, backness: 0, tense: false, meanDurMs: 130, examples: ['cat', 'bad', 'apple'], nameZh: '短元音 /æ/', tip: '嘴巴张大，下巴明显下降，嘴角向两侧拉，舌尖抵下齿、舌前部压低。中国学习者常读成 /e/：请把下巴再放低一些。' }),
  AA: P({ arpa: 'AA', ipaUS: 'ɑː', ipaUK: 'ɑː', kind: 'vowel', height: 0, backness: 2, tense: true, meanDurMs: 120, examples: ['father', 'hot (美)', 'car'], nameZh: '长元音 /ɑː/', tip: '嘴巴张大，舌头放平并后缩，舌后部压低，声音从口腔后部发出，像看医生时说 "啊"。' }),
  AO: P({ arpa: 'AO', ipaUS: 'ɔː', ipaUK: 'ɔː', kind: 'vowel', height: 1, backness: 2, rounded: true, tense: true, meanDurMs: 125, examples: ['law', 'thought', 'call'], nameZh: '长元音 /ɔː/', tip: '双唇收圆并略向前突出，舌后部抬起，口腔后部留出空间，声音饱满拉长。' }),
  OW: P({ arpa: 'OW', ipaUS: 'oʊ', ipaUK: 'əʊ', kind: 'vowel', height: 2, backness: 2, rounded: true, tense: true, diphthong: true, meanDurMs: 120, examples: ['go', 'home', 'boat'], nameZh: '双元音 /oʊ/（英 /əʊ/）', tip: '由 /o/（英式从 /ə/）开始，双唇逐渐收圆滑向 /ʊ/。不要读成单一的 "哦"，结尾要有收圆的滑动。' }),
  UH: P({ arpa: 'UH', ipaUS: 'ʊ', ipaUK: 'ʊ', kind: 'vowel', height: 2.6, backness: 1.7, rounded: true, tense: false, meanDurMs: 70, examples: ['book', 'good', 'put'], nameZh: '短元音 /ʊ/', tip: '双唇略圆但较放松，舌后部抬起，发音短促放松。不要像 /uː/ 那样把嘴唇噘得很紧。' }),
  UW: P({ arpa: 'UW', ipaUS: 'uː', ipaUK: 'uː', kind: 'vowel', height: 3, backness: 2, rounded: true, tense: true, meanDurMs: 105, examples: ['food', 'blue', 'two'], nameZh: '长元音 /uː/', tip: '双唇收小收圆并向前突出，舌后部高抬，肌肉紧张，声音拉长。' }),
  AH: P({ arpa: 'AH', ipaUS: 'ʌ', ipaUK: 'ʌ', kind: 'vowel', height: 1, backness: 1.4, tense: false, meanDurMs: 70, examples: ['cup', 'love', 'about (ə)'], nameZh: '短元音 /ʌ/ 或弱读 /ə/', tip: '重读时为 /ʌ/：嘴巴半开、舌位居中偏后、短促有力；非重读时为 /ə/：口腔完全放松，轻而短。不要读成汉语的 "啊"。' }),
  ER: P({ arpa: 'ER', ipaUS: 'ɜːr', ipaUK: 'ɜː', kind: 'vowel', height: 1.5, backness: 1, tense: true, rhotic: true, meanDurMs: 115, examples: ['bird', 'her', 'word'], nameZh: '卷舌元音 /ɜːr/（英 /ɜː/）', tip: '美式：舌尖上卷（或舌身隆起后缩），嘴唇略收，发出带 r 色彩的长元音；英式：舌位居中放松，不卷舌，声音拉长。' }),
  AY: P({ arpa: 'AY', ipaUS: 'aɪ', ipaUK: 'aɪ', kind: 'vowel', height: 0.3, backness: 1, diphthong: true, meanDurMs: 145, examples: ['my', 'time', 'like'], nameZh: '双元音 /aɪ/', tip: '从张大嘴的 /a/ 开始，滑向 /ɪ/，前重后轻，滑动要清楚。' }),
  AW: P({ arpa: 'AW', ipaUS: 'aʊ', ipaUK: 'aʊ', kind: 'vowel', height: 0.3, backness: 1, diphthong: true, meanDurMs: 150, examples: ['now', 'house', 'out'], nameZh: '双元音 /aʊ/', tip: '从 /a/ 开始，双唇逐渐收圆滑向 /ʊ/，前重后轻。' }),
  OY: P({ arpa: 'OY', ipaUS: 'ɔɪ', ipaUK: 'ɔɪ', kind: 'vowel', height: 1, backness: 2, rounded: true, diphthong: true, meanDurMs: 160, examples: ['boy', 'voice', 'join'], nameZh: '双元音 /ɔɪ/', tip: '从圆唇的 /ɔ/ 开始，滑向 /ɪ/，嘴唇由圆变扁。' }),

  P: P({ arpa: 'P', ipaUS: 'p', ipaUK: 'p', kind: 'consonant', voiced: false, place: 'bilabial', manner: 'stop', meanDurMs: 75, examples: ['pen', 'happy', 'stop'], nameZh: '清爆破音 /p/', tip: '双唇紧闭，气流积聚后突然放开，词首要明显送气（手放嘴前能感到气流）。' }),
  B: P({ arpa: 'B', ipaUS: 'b', ipaUK: 'b', kind: 'consonant', voiced: true, place: 'bilabial', manner: 'stop', meanDurMs: 60, examples: ['bad', 'baby', 'job'], nameZh: '浊爆破音 /b/', tip: '双唇紧闭后放开，声带振动，不送气。词尾的 /b/ 不要清化成 /p/，元音可稍拉长。' }),
  T: P({ arpa: 'T', ipaUS: 't', ipaUK: 't', kind: 'consonant', voiced: false, place: 'alveolar', manner: 'stop', meanDurMs: 65, examples: ['tea', 'water', 'cat'], nameZh: '清爆破音 /t/', tip: '舌尖抵上齿龈，气流冲破阻碍，词首送气。词尾 /t/ 可以不完全爆破，但要有舌尖的阻断动作，不要直接省略。' }),
  D: P({ arpa: 'D', ipaUS: 'd', ipaUK: 'd', kind: 'consonant', voiced: true, place: 'alveolar', manner: 'stop', meanDurMs: 55, examples: ['day', 'ladder', 'bed'], nameZh: '浊爆破音 /d/', tip: '舌尖抵上齿龈后放开，声带振动。词尾 /d/ 保持浊音特征，前面元音稍长。' }),
  K: P({ arpa: 'K', ipaUS: 'k', ipaUK: 'k', kind: 'consonant', voiced: false, place: 'velar', manner: 'stop', meanDurMs: 75, examples: ['key', 'school', 'back'], nameZh: '清爆破音 /k/', tip: '舌后部抵软腭，气流冲开，词首送气。' }),
  G: P({ arpa: 'G', ipaUS: 'ɡ', ipaUK: 'ɡ', kind: 'consonant', voiced: true, place: 'velar', manner: 'stop', meanDurMs: 60, examples: ['go', 'bigger', 'dog'], nameZh: '浊爆破音 /ɡ/', tip: '舌后部抵软腭后放开，声带振动。' }),
  CH: P({ arpa: 'CH', ipaUS: 'tʃ', ipaUK: 'tʃ', kind: 'consonant', voiced: false, place: 'postalveolar', manner: 'affricate', meanDurMs: 100, examples: ['chair', 'teacher', 'watch'], nameZh: '清破擦音 /tʃ/', tip: '舌尖和舌前部抵齿龈后部，双唇略突出呈圆形，先阻塞再摩擦。不要读成汉语的 "q" 或 "ch"（舌位更靠后、唇要圆）。' }),
  JH: P({ arpa: 'JH', ipaUS: 'dʒ', ipaUK: 'dʒ', kind: 'consonant', voiced: true, place: 'postalveolar', manner: 'affricate', meanDurMs: 80, examples: ['job', 'age', 'judge'], nameZh: '浊破擦音 /dʒ/', tip: '与 /tʃ/ 口型相同，但声带振动。不要读成汉语的 "j"（那是不圆唇的清音）。' }),
  F: P({ arpa: 'F', ipaUS: 'f', ipaUK: 'f', kind: 'consonant', voiced: false, place: 'labiodental', manner: 'fricative', meanDurMs: 95, examples: ['fish', 'coffee', 'laugh'], nameZh: '清摩擦音 /f/', tip: '上齿轻触下唇，气流从缝隙中摩擦而出，声带不振动。' }),
  V: P({ arpa: 'V', ipaUS: 'v', ipaUK: 'v', kind: 'consonant', voiced: true, place: 'labiodental', manner: 'fricative', meanDurMs: 60, examples: ['very', 'five', 'love'], nameZh: '浊摩擦音 /v/', tip: '上齿必须接触下唇，声带振动并持续摩擦。中国学习者常读成 /w/（双唇圆起、牙齿不碰嘴唇）——请确认上齿压住下唇。' }),
  TH: P({ arpa: 'TH', ipaUS: 'θ', ipaUK: 'θ', kind: 'consonant', voiced: false, place: 'dental', manner: 'fricative', meanDurMs: 90, examples: ['think', 'three', 'bath'], nameZh: '清齿间摩擦音 /θ/', tip: '舌尖轻放在上下齿之间（或轻触上齿背），气流从舌齿缝中摩擦送出，声带不振动。常见错误是读成 /s/（舌尖缩回齿龈）或 /f/（用嘴唇）。' }),
  DH: P({ arpa: 'DH', ipaUS: 'ð', ipaUK: 'ð', kind: 'consonant', voiced: true, place: 'dental', manner: 'fricative', meanDurMs: 45, examples: ['this', 'mother', 'with'], nameZh: '浊齿间摩擦音 /ð/', tip: '舌尖放在上下齿之间，声带振动，气流轻轻摩擦。不要读成 /z/、/d/ 或 /l/。' }),
  S: P({ arpa: 'S', ipaUS: 's', ipaUK: 's', kind: 'consonant', voiced: false, place: 'alveolar', manner: 'fricative', meanDurMs: 105, examples: ['see', 'city', 'bus'], nameZh: '清摩擦音 /s/', tip: '舌尖靠近上齿龈，留出窄缝，气流摩擦发出清晰的 "嘶" 声，声带不振动。' }),
  Z: P({ arpa: 'Z', ipaUS: 'z', ipaUK: 'z', kind: 'consonant', voiced: true, place: 'alveolar', manner: 'fricative', meanDurMs: 75, examples: ['zoo', 'easy', 'is'], nameZh: '浊摩擦音 /z/', tip: '舌位与 /s/ 相同，但声带振动，像蜜蜂 "嗡嗡" 声。词尾 -s 读 /z/ 时不要清化成 /s/。' }),
  SH: P({ arpa: 'SH', ipaUS: 'ʃ', ipaUK: 'ʃ', kind: 'consonant', voiced: false, place: 'postalveolar', manner: 'fricative', meanDurMs: 110, examples: ['she', 'nation', 'wish'], nameZh: '清摩擦音 /ʃ/', tip: '舌前部抬向齿龈后部，双唇略突出呈圆形，气流摩擦。比汉语 "sh" 舌位更靠前、唇更圆，也不同于 "x"。' }),
  ZH: P({ arpa: 'ZH', ipaUS: 'ʒ', ipaUK: 'ʒ', kind: 'consonant', voiced: true, place: 'postalveolar', manner: 'fricative', meanDurMs: 80, examples: ['vision', 'usually', 'measure'], nameZh: '浊摩擦音 /ʒ/', tip: '与 /ʃ/ 口型相同，声带振动。不要读成汉语的 "r"。' }),
  HH: P({ arpa: 'HH', ipaUS: 'h', ipaUK: 'h', kind: 'consonant', voiced: false, place: 'glottal', manner: 'fricative', meanDurMs: 60, examples: ['hat', 'behind', 'who'], nameZh: '声门摩擦音 /h/', tip: '口型保持后面元音的形状，气流从喉部轻轻呼出，不要像汉语 "h" 那样在舌根产生强烈摩擦。' }),
  M: P({ arpa: 'M', ipaUS: 'm', ipaUK: 'm', kind: 'consonant', voiced: true, place: 'bilabial', manner: 'nasal', meanDurMs: 65, examples: ['man', 'summer', 'time'], nameZh: '鼻音 /m/', tip: '双唇闭合，气流从鼻腔出来，声带振动。词尾 /m/ 要闭上嘴唇。' }),
  N: P({ arpa: 'N', ipaUS: 'n', ipaUK: 'n', kind: 'consonant', voiced: true, place: 'alveolar', manner: 'nasal', meanDurMs: 60, examples: ['no', 'dinner', 'sun'], nameZh: '鼻音 /n/', tip: '舌尖抵住上齿龈，气流从鼻腔出来。注意与 /l/ 区分（/l/ 气流从舌两侧流出）。' }),
  NG: P({ arpa: 'NG', ipaUS: 'ŋ', ipaUK: 'ŋ', kind: 'consonant', voiced: true, place: 'velar', manner: 'nasal', meanDurMs: 70, examples: ['sing', 'long', 'thinking'], nameZh: '后鼻音 /ŋ/', tip: '舌后部抵软腭，气流从鼻腔出来。不要在后面多加 /ɡ/，也不要读成前鼻音 /n/。' }),
  L: P({ arpa: 'L', ipaUS: 'l', ipaUK: 'l', kind: 'consonant', voiced: true, place: 'alveolar', manner: 'lateral', meanDurMs: 60, examples: ['light', 'hello', 'feel'], nameZh: '舌侧音 /l/', tip: '舌尖抵上齿龈，气流从舌两侧流出。词尾的 "暗 l"（如 feel）舌尖仍要抵住齿龈、舌后部抬起，不要读成 "哦" 或省略。' }),
  R: P({ arpa: 'R', ipaUS: 'r', ipaUK: 'r', kind: 'consonant', voiced: true, place: 'alveolar', manner: 'approximant', meanDurMs: 60, examples: ['red', 'sorry', 'car (美)'], nameZh: '近音 /r/', tip: '舌尖向上卷起但不接触上颚（或舌身后缩隆起），双唇略圆。不要读成汉语的 "r"（有摩擦），也不要读成 /l/ 或 /w/。' }),
  W: P({ arpa: 'W', ipaUS: 'w', ipaUK: 'w', kind: 'consonant', voiced: true, place: 'labiovelar', manner: 'approximant', meanDurMs: 60, examples: ['we', 'away', 'one'], nameZh: '近音 /w/', tip: '双唇收圆突出（像 /uː/），然后迅速滑向后面的元音，牙齿不碰嘴唇。' }),
  Y: P({ arpa: 'Y', ipaUS: 'j', ipaUK: 'j', kind: 'consonant', voiced: true, place: 'palatal', manner: 'approximant', meanDurMs: 55, examples: ['yes', 'you', 'music'], nameZh: '近音 /j/', tip: '舌前部抬向硬腭（像 /iː/），然后迅速滑向后面的元音。' }),
};

export const PHONE_LIST = Object.keys(PHONES);
export const VOWELS = new Set(PHONE_LIST.filter((p) => PHONES[p].kind === 'vowel'));

export function stripStress(arpa: string): string {
  return arpa.replace(/[0-2]$/, '');
}

export function stressOf(arpa: string): number | null {
  const m = /([0-2])$/.exec(arpa);
  return m ? Number(m[1]) : null;
}

export function isVowel(arpa: string): boolean {
  return VOWELS.has(stripStress(arpa));
}

/** IPA for one ARPABET phone (with optional stress digit) in the given accent. */
export function phoneIpa(arpa: string, accent: 'us' | 'uk'): string {
  const base = stripStress(arpa);
  const s = stressOf(arpa);
  const info = PHONES[base];
  if (!info) return base.toLowerCase();
  if (base === 'AH' && s === 0) return 'ə';
  if (base === 'ER' && s === 0) return accent === 'us' ? 'ər' : 'ə';
  if (base === 'IY' && s === 0) return 'i';
  if (base === 'UW' && s === 0) return 'u';
  return accent === 'us' ? info.ipaUS : info.ipaUK;
}

// English onsets allowed when syllabifying for stress-mark placement
const ONSETS = new Set([
  'P', 'B', 'T', 'D', 'K', 'G', 'CH', 'JH', 'F', 'V', 'TH', 'DH', 'S', 'Z', 'SH', 'ZH', 'HH', 'M', 'N', 'L', 'R', 'W', 'Y',
  'P R', 'P L', 'B R', 'B L', 'T R', 'T W', 'D R', 'D W', 'K R', 'K L', 'K W', 'G R', 'G L', 'G W', 'F R', 'F L', 'TH R', 'TH W',
  'SH R', 'S P', 'S T', 'S K', 'S M', 'S N', 'S L', 'S W', 'S F', 'S P R', 'S P L', 'S T R', 'S K R', 'S K W', 'S K L',
  'P Y', 'B Y', 'K Y', 'G Y', 'F Y', 'V Y', 'M Y', 'HH Y', 'S P Y', 'S K Y', 'D Y', 'T Y', 'N Y', 'L Y',
]);

/** Split a phone sequence (stress-marked ARPABET) into syllables using maximal onset. */
export function syllabify(phones: string[]): string[][] {
  const nuclei: number[] = [];
  phones.forEach((p, i) => { if (isVowel(p)) nuclei.push(i); });
  if (nuclei.length === 0) return [phones.slice()];
  const bounds: number[] = [0];
  for (let k = 1; k < nuclei.length; k++) {
    const a = nuclei[k - 1] + 1;
    const b = nuclei[k];
    // consonants between a..b-1; choose the longest legal onset for syllable k
    let start = b;
    for (let s = a; s <= b; s++) {
      const onset = phones.slice(s, b).map(stripStress).join(' ');
      if (onset === '' || ONSETS.has(onset)) { start = s; break; }
    }
    bounds.push(start);
  }
  const out: string[][] = [];
  for (let k = 0; k < bounds.length; k++) out.push(phones.slice(bounds[k], k + 1 < bounds.length ? bounds[k + 1] : phones.length));
  return out;
}

/** Dictionary-style IPA for a word pronunciation, stress marks at syllable onsets. */
export function pronIpa(phones: string[], accent: 'us' | 'uk'): string {
  const sylls = syllabify(phones);
  const multi = sylls.filter((s) => s.some(isVowel)).length > 1;
  let out = '';
  for (const syl of sylls) {
    const v = syl.find(isVowel);
    const s = v ? stressOf(v) : null;
    if (multi && s === 1) out += 'ˈ';
    else if (multi && s === 2) out += 'ˌ';
    for (let i = 0; i < syl.length; i++) {
      const p = syl[i];
      const base = stripStress(p);
      if (accent === 'uk' && base === 'R') {
        // non-rhotic: /r/ only before a vowel (onset position)
        const next = syl[i + 1];
        if (!next || !isVowel(next)) continue;
      }
      out += phoneIpa(p, accent);
    }
  }
  return out;
}

// --- similarity between phones (0 = identical … 1 = unrelated), used when
//     aligning recognised phones against the canonical sequence ---
export function phoneDistance(a: string, b: string): number {
  a = stripStress(a);
  b = stripStress(b);
  if (a === b) return 0;
  const A = PHONES[a];
  const B = PHONES[b];
  if (!A || !B) return 1;
  if (A.kind !== B.kind) {
    // glides vs high vowels and r vs ER are near neighbours
    const pair = [a, b].sort().join(' ');
    if (pair === 'IY Y' || pair === 'UW W' || pair === 'ER R') return 0.45;
    return 1;
  }
  if (A.kind === 'vowel') {
    const dh = Math.abs((A.height ?? 0) - (B.height ?? 0)) / 3;
    const db = Math.abs((A.backness ?? 0) - (B.backness ?? 0)) / 2;
    const dr = A.rounded === B.rounded ? 0 : 0.15;
    const dd = !!A.diphthong === !!B.diphthong ? 0 : 0.15;
    return Math.min(0.95, 0.15 + 0.45 * dh + 0.3 * db + dr + dd);
  }
  let d = 0.15;
  if (A.voiced !== B.voiced) d += 0.2;
  if (A.place !== B.place) d += 0.3;
  if (A.manner !== B.manner) d += 0.35;
  return Math.min(0.95, d);
}

// Specific advice for substitutions that Chinese-speaking learners commonly make.
const PAIR_ADVICE: Record<string, string> = {
  'TH>S': '把 /θ/ 读成了 /s/：舌尖缩回到了齿龈。请把舌尖伸到上下齿之间，轻轻送气。',
  'TH>F': '把 /θ/ 读成了 /f/：用了下唇代替舌尖。请让嘴唇放松，用舌尖接触上齿。',
  'TH>T': '把 /θ/ 读成了 /t/：舌尖形成了完全阻塞。/θ/ 是持续摩擦音，舌尖放在齿间并持续送气。',
  'DH>Z': '把 /ð/ 读成了 /z/：舌尖缩回到了齿龈。舌尖放在上下齿之间，声带振动。',
  'DH>D': '把 /ð/ 读成了 /d/：发成了爆破音。/ð/ 需要舌尖在齿间持续轻摩擦。',
  'DH>L': '把 /ð/ 读成了 /l/：舌尖位置正确，但需要让气流从舌尖和牙齿间摩擦，而不是从舌两侧流出。',
  'V>W': '把 /v/ 读成了 /w/：双唇收圆了。请用上齿轻压下唇，并让声带振动。',
  'V>F': '/v/ 发成了清音 /f/：口型正确，但需要让声带振动（摸喉咙应有震动）。',
  'W>V': '把 /w/ 读成了 /v/：牙齿碰到了嘴唇。/w/ 只需双唇收圆，然后快速滑开。',
  'N>L': '把 /n/ 读成了 /l/：气流应从鼻腔出来。捏住鼻子时 /n/ 应发不出声。',
  'L>N': '把 /l/ 读成了 /n/：气流从鼻腔出来了。舌尖抵齿龈，让气流从舌两侧流出。',
  'R>L': '把 /r/ 读成了 /l/：舌尖接触了上齿龈。/r/ 的舌尖不接触任何地方，舌身后缩、嘴唇略圆。',
  'R>W': '把 /r/ 读成了 /w/：只用了嘴唇。还需要舌尖上卷或舌身后缩。',
  'IY>IH': '长元音 /iː/ 读成了短元音 /ɪ/：舌位不够高、肌肉不够紧张，也偏短。',
  'IH>IY': '短元音 /ɪ/ 读成了 /iː/：舌位过高、过紧。放松口腔，舌位稍低，读短一些。',
  'AE>EH': '/æ/ 读成了 /e/：嘴巴张得不够大。下巴再往下放，嘴角向两侧拉开。',
  'EH>AE': '/e/ 读成了 /æ/：嘴巴张得太大。下巴稍抬起，开口小一些。',
  'AH>AA': '/ʌ/ 读成了 /ɑː/：舌位太靠后、太长。/ʌ/ 短促，舌位居中。',
  'UW>UH': '/uː/ 读成了 /ʊ/：嘴唇不够圆、不够紧，也偏短。',
  'UH>UW': '/ʊ/ 读成了 /uː/：嘴唇太紧、太长。放松嘴唇，读短一些。',
  'NG>N': '后鼻音 /ŋ/ 读成了前鼻音 /n/：舌尖不要抵齿龈，用舌后部抵住软腭。',
  'N>NG': '前鼻音 /n/ 读成了后鼻音 /ŋ/：用舌尖抵住上齿龈结束发音。',
  'Z>S': '/z/ 发成了清音 /s/：保持声带振动，尤其是在词尾（如 is、was、dogs）。',
  'D>T': '/d/ 发成了清音 /t/：保持声带振动，词尾浊辅音前的元音也要稍长。',
  'B>P': '/b/ 发成了清音 /p/：保持声带振动，不要送气。',
  'G>K': '/ɡ/ 发成了清音 /k/：保持声带振动。',
  'SH>S': '/ʃ/ 读成了 /s/：舌位太靠前、嘴唇没有收圆。舌前部后移，双唇略突出。',
  'S>SH': '/s/ 读成了 /ʃ/：舌尖应更靠前，嘴唇放平。',
  'ZH>SH': '/ʒ/ 发成了清音 /ʃ/：需要声带振动。',
  'CH>SH': '/tʃ/ 读成了 /ʃ/：缺少开头的阻塞动作，先用舌尖抵住齿龈再放开摩擦。',
  'JH>ZH': '/dʒ/ 读成了 /ʒ/：缺少开头的阻塞动作。',
  'OW>AO': '双元音 /oʊ/ 读成了单元音 /ɔː/：结尾要把嘴唇收圆滑向 /ʊ/。',
  'EY>EH': '双元音 /eɪ/ 读成了单元音 /e/：结尾要滑向 /ɪ/。',
  'AY>AA': '双元音 /aɪ/ 缺少滑动：结尾要滑向 /ɪ/。',
  'AW>AA': '双元音 /aʊ/ 缺少滑动：结尾要收圆滑向 /ʊ/。',
  'ER>AH': '/ɜːr/ 卷舌或舌位不到位，听起来像 /ʌ/。美式需舌尖上卷，英式需舌位居中并拉长。',
  'ER>AO': '/ɜː/ 读成了 /ɔː/：嘴唇不要收圆，舌位居中。',
  'AO>AA': '/ɔː/ 读成了 /ɑː/：嘴唇需要收圆。',
  'AA>AO': '/ɑː/ 读成了 /ɔː/：嘴唇不要收圆，张大嘴。',
  'HH>K': '/h/ 摩擦太强，接近 /k/ 或汉语 "h"：放松舌根，只用气流轻轻呼出。',
};

const PLACE_ZH: Record<string, string> = {
  bilabial: '双唇', labiodental: '唇齿', dental: '齿间', alveolar: '齿龈', postalveolar: '齿龈后', palatal: '硬腭', velar: '软腭', glottal: '声门', labiovelar: '圆唇软腭',
};
const MANNER_ZH: Record<string, string> = {
  stop: '爆破音', fricative: '摩擦音', affricate: '破擦音', nasal: '鼻音', lateral: '舌侧音', approximant: '近音',
};

/** Chinese explanation of the difference between the expected and the detected phone. */
export function substitutionAdvice(expected: string, heard: string): string {
  const e = stripStress(expected);
  const h = stripStress(heard);
  const specific = PAIR_ADVICE[`${e}>${h}`];
  if (specific) return specific;
  const E = PHONES[e];
  const H = PHONES[h];
  if (!E || !H) return E ? E.tip : '';
  const parts: string[] = [];
  if (E.kind === 'consonant' && H.kind === 'consonant') {
    if (E.voiced !== H.voiced) parts.push(E.voiced ? '需要声带振动（浊音）' : '不要让声带振动（清音）');
    if (E.place !== H.place) parts.push(`发音部位应为${PLACE_ZH[E.place!]}，听起来更像${PLACE_ZH[H.place!]}`);
    if (E.manner !== H.manner) parts.push(`发音方式应为${MANNER_ZH[E.manner!]}，而不是${MANNER_ZH[H.manner!]}`);
  } else if (E.kind === 'vowel' && H.kind === 'vowel') {
    const dh = (E.height ?? 0) - (H.height ?? 0);
    const db = (E.backness ?? 0) - (H.backness ?? 0);
    if (Math.abs(dh) >= 0.5) parts.push(dh > 0 ? '舌位需要更高（开口更小）' : '舌位需要更低（开口更大）');
    if (Math.abs(db) >= 0.5) parts.push(db > 0 ? '舌位需要更靠后' : '舌位需要更靠前');
    if (!!E.rounded !== !!H.rounded) parts.push(E.rounded ? '嘴唇需要收圆' : '嘴唇不要收圆');
    if (!!E.diphthong !== !!H.diphthong) parts.push(E.diphthong ? '这是双元音，需要完整的滑动' : '这是单元音，舌位保持稳定');
    if (!!E.tense !== !!H.tense) parts.push(E.tense ? '肌肉更紧张、音更长' : '口腔放松、读得更短');
  } else {
    parts.push(E.kind === 'vowel' ? '这里应是元音' : '这里应是辅音');
  }
  const head = `/${E.ipaUS}/ 听起来更像 /${H.ipaUS}/`;
  return parts.length ? `${head}：${parts.join('；')}。${E.tip}` : `${head}。${E.tip}`;
}

// Mapping from espeak-ng IPA (as produced for en-gb-x-rp / en-us) to ARPABET,
// used to derive accent variants and to pronounce words missing from CMUdict.
const ESPEAK_MAP: Array<[string, string[]]> = [
  ['aɪə', ['AY', 'AH']], ['aʊə', ['AW', 'AH']],
  ['eɪ', ['EY']], ['aɪ', ['AY']], ['aʊ', ['AW']], ['ɔɪ', ['OY']], ['oʊ', ['OW']], ['əʊ', ['OW']],
  ['eə', ['EH', 'R']], ['ɪə', ['IH', 'R']], ['ʊə', ['UH', 'R']], ['ɛɹ', ['EH', 'R']], ['ɪɹ', ['IH', 'R']], ['ʊɹ', ['UH', 'R']],
  ['ɑːɹ', ['AA', 'R']], ['ɔːɹ', ['AO', 'R']], ['oːɹ', ['AO', 'R']], ['ɜːɹ', ['ER']], ['ɝ', ['ER']], ['ɚ', ['ER']],
  ['iː', ['IY']], ['uː', ['UW']], ['ɑː', ['AA']], ['ɔː', ['AO']], ['ɜː', ['ER']], ['oː', ['AO']], ['aː', ['AA']],
  ['tʃ', ['CH']], ['dʒ', ['JH']],
  ['i', ['IY']], ['ɪ', ['IH']], ['e', ['EH']], ['ɛ', ['EH']], ['æ', ['AE']], ['a', ['AE']], ['ɐ', ['AH']], ['ʌ', ['AH']], ['ə', ['AH']],
  ['ɒ', ['AA']], ['ɑ', ['AA']], ['ɔ', ['AO']], ['o', ['OW']], ['ʊ', ['UH']], ['u', ['UW']], ['ᵻ', ['IH']], ['ɾ', ['T']],
  ['p', ['P']], ['b', ['B']], ['t', ['T']], ['d', ['D']], ['k', ['K']], ['ɡ', ['G']], ['g', ['G']],
  ['f', ['F']], ['v', ['V']], ['θ', ['TH']], ['ð', ['DH']], ['s', ['S']], ['z', ['Z']], ['ʃ', ['SH']], ['ʒ', ['ZH']], ['h', ['HH']],
  ['m', ['M']], ['n', ['N']], ['ŋ', ['NG']], ['l', ['L']], ['ɹ', ['R']], ['r', ['R']], ['w', ['W']], ['j', ['Y']], ['ʔ', ['T']],
];

/** Convert one espeak IPA word (with ˈ ˌ marks) to stress-marked ARPABET. */
export function espeakToArpa(ipa: string): string[] {
  const out: string[] = [];
  let stress = 0;
  let i = 0;
  const s = ipa.replace(/[ː]+/g, 'ː').replace(/[̩̃]/g, '');
  while (i < s.length) {
    const ch = s[i];
    if (ch === 'ˈ') { stress = 1; i++; continue; }
    if (ch === 'ˌ') { stress = 2; i++; continue; }
    if (ch === '-' || ch === ' ' || ch === '.' || ch === '‿') { i++; continue; }
    let matched = false;
    for (const [k, arr] of ESPEAK_MAP) {
      if (s.startsWith(k, i)) {
        for (const a of arr) {
          if (VOWELS.has(a)) {
            out.push(a + String(arr.length > 1 && a === 'AH' ? 0 : stress));
            stress = 0;
          } else out.push(a);
        }
        i += k.length;
        matched = true;
        break;
      }
    }
    if (!matched) i++;
  }
  // words without an explicit stress mark get primary stress on their only vowel
  const vowels = out.filter(isVowel);
  if (vowels.length === 1) return out.map((p) => (isVowel(p) && p.endsWith('0') && stripStress(p) !== 'AH' ? stripStress(p) + '1' : p));
  return out;
}

/**
 * Dictionary-style rendering of espeak-ng IPA: RP/GA symbol conventions and
 * stress marks moved from the vowel to the start of the syllable.
 */
export function formatEspeakIpa(raw: string): string {
  const s = raw
    .replace(/ɐ/g, 'ə').replace(/ɹ/g, 'r').replace(/ᵻ/g, 'ɪ').replace(/ɾ/g, 't').replace(/ʔ/g, 't')
    .replace(/[̩̃]/g, '').replace(/ɚ/g, 'ər').replace(/ɝ/g, 'ɜːr').replace(/ɛ/g, 'e').replace(/oː/g, 'ɔː');
  type Tok = { text: string; vowel: boolean; arpa: string | null; stress: string };
  const toks: Tok[] = [];
  let pending = '';
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === 'ˈ' || ch === 'ˌ') { pending = ch; i++; continue; }
    if (ch === ' ' || ch === '-') { toks.push({ text: ' ', vowel: false, arpa: null, stress: '' }); i++; continue; }
    let hit: [string, string[]] | undefined;
    for (const e of ESPEAK_MAP) if (s.startsWith(e[0], i)) { hit = e; break; }
    if (!hit) {
      // symbols outside the map (e.g. normalised 'ər' parts) pass through
      const vowel = /[aeiouəɪʊʌɒɔæɑɜ]/.test(ch);
      toks.push({ text: ch, vowel, arpa: null, stress: vowel ? pending : '' });
      if (vowel) pending = '';
      i++;
      continue;
    }
    const vowel = hit[1].some((a) => VOWELS.has(a));
    toks.push({ text: hit[0], vowel, arpa: vowel ? null : hit[1].join(' '), stress: vowel ? pending : '' });
    if (vowel) pending = '';
    i += hit[0].length;
  }
  // place stress marks before the maximal legal onset
  const out: string[] = toks.map((t) => t.text);
  for (let k = 0; k < toks.length; k++) {
    if (!toks[k].vowel || !toks[k].stress) continue;
    let start = k;
    for (let j = k - 1; j >= 0; j--) {
      if (toks[j].vowel || toks[j].text === ' ' || !toks[j].arpa) break;
      const onset = toks.slice(j, k).map((t) => t.arpa).join(' ');
      if (ONSETS.has(onset)) start = j;
      else break;
    }
    // the first syllable of a word only gets a mark if the word has several syllables
    out[start] = toks[k].stress + out[start];
  }
  // monosyllables carry no stress mark in dictionary style
  return out.join('').trim().split(/\s+/).map((w) => (countVowels(toks, w) <= 1 ? w.replace(/[ˈˌ]/g, '') : w)).join(' ');
}

function countVowels(_toks: unknown, w: string): number {
  const m = w.replace(/[ˈˌ]/g, '').match(/(aɪ|aʊ|eɪ|ɔɪ|oʊ|əʊ|eə|ɪə|ʊə|iː|uː|ɑː|ɔː|ɜː|[aeiouəɪʊʌɒɔæɑɜ])/g);
  return m ? m.length : 0;
}
