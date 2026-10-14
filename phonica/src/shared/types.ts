// Types shared by the engine, the main process, the renderer and the exporters.
// The AssessmentResult is also the core of the exported analysis.json.

export type Accent = 'us' | 'uk';
export type PracticeMode = 'word' | 'sentence' | 'passage';

export type PhoneRating = 'good' | 'fair' | 'poor' | 'missing';

export interface PhoneResult {
  /** canonical phone, stress-marked ARPABET (e.g. "AE1") */
  arpa: string;
  /** IPA symbol in the target accent */
  ipa: string;
  start: number;
  end: number;
  /** 0–100, calibrated on speechocean762 phone accuracy (0–2 scale × 50) */
  score: number;
  rating: PhoneRating;
  gop: { lpp: number; lpr: number; frameAcc: number; margin: number; silFrac: number; ctc?: number; ctcDel?: number; ctcPeak?: number };
  /** best competing phone from the acoustic evidence */
  closest?: { arpa: string; ipa: string; margin: number };
  error?: {
    type: 'substitution' | 'deletion' | 'distortion' | 'insertion';
    heard?: string;
    heardIpa?: string;
    /** both acoustic models (frame classifier and CTC recognizer) independently heard `heard` */
    confirmed?: boolean;
    advice: string;
  };
}

export interface SyllableStress {
  phoneIndex: number;
  expectedStress: number;
  energyDb: number;
  f0St: number | null;
  durNorm: number;
  prominence: number;
}

export interface WordResult {
  index: number;
  tokenIndex: number;
  text: string;
  spoken: string;
  start: number;
  end: number;
  skipped: boolean;
  isFunction: boolean;
  /** 0–100 word pronunciation accuracy */
  score: number;
  rating: PhoneRating;
  phones: PhoneResult[];
  pron: { arpa: string[]; source: string; accent: 'us' | 'uk' | 'both'; matchesTarget: boolean };
  ipaUS: string;
  ipaUK: string;
  stress?: { expected: number; detected: number; correct: boolean; score: number; syllables: SyllableStress[] };
  pauseAfter?: number;
  /** what the phoneme recogniser heard in this word (IPA) */
  heard?: string;
  /** extra sound detected after the word (e.g. an added /ə/) */
  epenthesis?: { ipa: string; start: number; end: number };
  notes: string[];
}

export interface TokenMap {
  index: number;
  text: string;
  charStart: number;
  charEnd: number;
  punctAfter: string;
  sentence: number;
  words: number[];
}

export interface SentenceResult {
  index: number;
  text: string;
  type: string;
  firstWord: number;
  lastWord: number;
  start: number;
  end: number;
  score: number;
  /** calibrated sentence-level scores (0–100) for this sentence */
  scores?: { accuracy: number; fluency: number; prosody: number; total: number };
}

export interface PauseResult {
  afterWord: number;
  start: number;
  end: number;
  duration: number;
  kind: 'boundary' | 'hesitation' | 'filler';
  disfluent: boolean;
}

export interface IntonationResult {
  sentence: number;
  type: string;
  expected: 'fall' | 'rise' | 'any';
  detected: 'fall' | 'rise' | 'level' | 'unknown';
  slopeSt: number;
  ok: boolean;
}

export interface Issue {
  severity: 'high' | 'medium' | 'low';
  category: 'phoneme' | 'word' | 'omission' | 'insertion' | 'stress' | 'intonation' | 'fluency' | 'rate' | 'rhythm' | 'accent';
  title: string;
  detail: string;
  words?: number[];
  phone?: string;
  time?: number;
}

export interface VowelPoint {
  word: number;
  phone: number;
  arpa: string;
  f1: number;
  f2: number;
  score: number;
}

export interface AssessmentResult {
  schema: 'phonica.assessment/1';
  id: string;
  createdAt: string;
  text: string;
  accent: Accent;
  mode: PracticeMode;
  engine: {
    app: string;
    acousticModel: string;
    acousticRevision: string | null;
    scoring: string;
    scoringMetrics: Record<string, number>;
    analysisMs: number;
  };
  audio: { durationSec: number; sampleRate: number; analysisRate: number };
  scores: {
    overall: number;
    accuracy: number;
    fluency: number;
    completeness: number;
    prosody: number;
    stress: number | null;
    intonation: number | null;
    rhythm: number | null;
  };
  words: WordResult[];
  tokens: TokenMap[];
  sentences: SentenceResult[];
  fluency: {
    speechStart: number;
    speechEnd: number;
    speakingTime: number;
    articulationTime: number;
    wordsPerMinute: number;
    syllablesPerSecond: number;
    articulationRate: number;
    pauseCount: number;
    disfluentPauseCount: number;
    longPauseCount: number;
    fillerCount: number;
    pauseRatio: number;
    meanLengthOfRun: number;
    longestPause: number;
    pauses: PauseResult[];
  };
  prosody: {
    f0MedianHz: number;
    pitchRangeSt: number;
    pitchSdSt: number;
    monotone: boolean;
    nPVI: number;
    contentFunctionDiff: number;
    stressAccuracy: number;
    intonation: IntonationResult[];
  };
  recognized: Array<{ arpa: string; ipa: string; start: number; end: number; conf: number }>;
  vowels: VowelPoint[];
  speakerProfile: 'male' | 'female' | 'unknown';
  tracks: { hop: number; f0: number[]; energyDb: number[] };
  issues: Issue[];
  summary: { level: string; strengths: string[]; focus: string[] };
}

export interface AssessRequest {
  text: string;
  accent: Accent;
  mode: PracticeMode;
  /** mono PCM at `sampleRate` */
  samples: Float32Array;
  sampleRate: number;
}

// ---------------- settings ----------------

export type AiProviderKind = 'openai' | 'anthropic' | 'deepseek' | 'gemini' | 'custom-openai';

export interface AiProviderConfig {
  id: string;
  name: string;
  kind: AiProviderKind;
  baseUrl: string;
  apiKey: string;
  model: string;
  /** model accepts audio input (OpenAI-style input_audio) */
  audioInput: boolean;
  temperature: number;
  maxTokens: number;
}

export interface Settings {
  accent: Accent;
  voiceUS: string;
  voiceUK: string;
  ttsSpeed: number;
  theme: 'system' | 'light' | 'dark';
  inputDeviceId: string;
  recordSampleRate: 48000 | 44100 | 16000;
  autoStopSilenceSec: number;
  exportBitrate: 32 | 48 | 64 | 96 | 128 | 192;
  exportSampleRate: 16000 | 22050 | 24000 | 44100;
  exportIncludeReference: boolean;
  aiProviders: AiProviderConfig[];
  aiActiveProvider: string;
  aiLanguage: 'zh' | 'en';
  dataDir: string;
}

export interface HistoryEntry {
  id: string;
  createdAt: string;
  text: string;
  mode: PracticeMode;
  accent: Accent;
  durationSec: number;
  scores: AssessmentResult['scores'];
  wordCount: number;
  materialId?: string;
  favorite?: boolean;
  aiCount?: number;
  /** per-phone [occurrences, poor-or-missing count, score sum] for weak-point statistics */
  phoneStats: Record<string, [number, number, number]>;
  /** words scored below 70: [spoken word, score, expected-phone pattern of the worst error] */
  weakWords: Array<[string, number, string]>;
}

export interface Material {
  id: string;
  title: string;
  text: string;
  category: string;
  level?: string;
  builtin?: boolean;
  createdAt?: string;
}

export interface AiAnalysis {
  id: string;
  createdAt: string;
  provider: string;
  model: string;
  /** whether the recording itself was sent (model listens to audio) */
  withAudio: boolean;
  content: string;
  usage?: { inputTokens?: number; outputTokens?: number };
  error?: string;
}

export interface ExportOptions {
  kind: 'zip' | 'audio' | 'report' | 'json' | 'prompt';
  bitrate: number;
  sampleRate: number;
  includeReference: boolean;
}

export interface WeakStats {
  phones: Array<{ arpa: string; ipa: string; total: number; bad: number; avg: number; rate: number }>;
  words: Array<{ word: string; count: number; avg: number; lastSeen: string; pattern: string }>;
  totalRecords: number;
  totalMinutes: number;
  trend: Array<{ date: string; overall: number; accuracy: number; fluency: number; prosody: number; n: number }>;
}
