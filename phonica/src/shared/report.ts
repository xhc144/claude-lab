// Human- and AI-readable renderings of an assessment: a Markdown report that
// carries every measurement, and the analysis prompt used both by the in-app
// AI module and the "export for external AI" package.
import type { AssessmentResult, WordResult } from './types.ts';

const f1 = (v: number) => (Math.round(v * 10) / 10).toFixed(1);
const f2 = (v: number) => (Math.round(v * 100) / 100).toFixed(2);
const t = (v: number) => (v < 0 ? '—' : f2(v));

const ERR: Record<string, string> = { substitution: '替换', deletion: '漏读', distortion: '不准确', insertion: '多读' };
const MODE: Record<string, string> = { word: '单词', sentence: '句子', passage: '文章' };

function phoneCell(w: WordResult): string {
  return w.phones
    .map((p) => {
      const e = p.error ? `,${ERR[p.error.type]}${p.error.heardIpa ? '→/' + p.error.heardIpa + '/' : ''}${p.error.confirmed ? '（双模型确认）' : ''}` : '';
      return `/${p.ipa}/ ${p.score}${e}`;
    })
    .join(' · ');
}

export function textReport(r: AssessmentResult, audioInfo?: { file: string; codec: string; bitrate?: number; sampleRate: number; bytes: number }): string {
  const L: string[] = [];
  const s = r.scores;
  L.push(`# 英语朗读发音评测报告`);
  L.push('');
  L.push(`- 评测 ID：${r.id}`);
  L.push(`- 时间：${r.createdAt}`);
  L.push(`- 模式：${MODE[r.mode] ?? r.mode}　目标口音：${r.accent === 'us' ? '美式 (General American)' : '英式 (RP)'}`);
  L.push(`- 录音时长：${f2(r.audio.durationSec)} 秒（原始采样率 ${r.audio.sampleRate} Hz，分析采样率 16 kHz）`);
  if (audioInfo) L.push(`- 随附音频：${audioInfo.file}（${audioInfo.codec}${audioInfo.bitrate ? ` ${audioInfo.bitrate} kbps` : ''}，${audioInfo.sampleRate} Hz，单声道，${(audioInfo.bytes / 1024).toFixed(0)} KB）`);
  L.push(`- 评测引擎：Phonica ${r.engine.app}；声学模型 ${r.engine.acousticModel}；评分校准：${r.engine.scoring}`);
  L.push('');
  L.push('## 朗读原文');
  L.push('');
  L.push('```text');
  L.push(r.text);
  L.push('```');
  L.push('');
  L.push('## 总体评分（0–100）');
  L.push('');
  L.push('| 总分 | 准确度 | 流利度 | 完整度 | 韵律 | 单词重音正确率 | 句尾语调正确率 |');
  L.push('|---|---|---|---|---|---|---|');
  L.push(`| ${s.overall} | ${s.accuracy} | ${s.fluency} | ${s.completeness} | ${s.prosody} | ${s.stress ?? '—'} | ${s.intonation ?? '—'} |`);
  L.push('');
  L.push(`等级：${r.summary.level}。${r.summary.strengths.length ? '优点：' + r.summary.strengths.join('；') + '。' : ''}`);
  L.push('');
  L.push('## 主要问题（按严重程度排序）');
  L.push('');
  if (!r.issues.length) L.push('未发现明显问题。');
  r.issues.forEach((i, k) => L.push(`${k + 1}. [${i.severity === 'high' ? '严重' : i.severity === 'medium' ? '中等' : '轻微'}][${i.category}] ${i.title} —— ${i.detail}`));
  L.push('');
  L.push('## 逐词分析');
  L.push('');
  L.push('时间单位为秒；音素评分 0–100（≥80 良好，60–79 一般，<60 错误）。“识别到”为音素识别模型对该词实际读音的转写（IPA）。');
  L.push('');
  L.push('| # | 单词 | 起止时间 | 得分 | 标准音标 | 识别到 | 音素（评分, 错误） | 重音 | 词后停顿 |');
  L.push('|---|---|---|---|---|---|---|---|---|');
  for (const w of r.words) {
    const ipa = r.accent === 'us' ? w.ipaUS : w.ipaUK;
    const stress = w.stress ? `${w.stress.correct ? '正确' : '错误'}（应在第${w.stress.expected + 1}音节，检测到第${w.stress.detected + 1}音节）` : '—';
    L.push(`| ${w.index + 1} | ${w.text}${w.spoken !== w.text.toLowerCase() ? ` (${w.spoken})` : ''} | ${w.skipped ? '未读' : `${t(w.start)}–${t(w.end)}`} | ${w.score} | /${ipa}/ | ${w.heard ? '/' + w.heard + '/' : '—'} | ${w.skipped ? '整词漏读' : phoneCell(w)} | ${stress} | ${w.pauseAfter ? f2(w.pauseAfter) + ' s' : ''} |`);
  }
  L.push('');
  const errs = r.words.flatMap((w) => w.phones.filter((p) => p.error).map((p) => ({ w, p })));
  if (errs.length) {
    L.push('## 音素错误明细');
    L.push('');
    L.push('| 单词 | 时间 | 目标音素 | 类型 | 听起来像 | 评分 | 声学证据 (LPR / CTC-GOP) |');
    L.push('|---|---|---|---|---|---|---|');
    for (const { w, p } of errs) L.push(`| ${w.text} | ${t(p.start)}–${t(p.end)} | /${p.ipa}/ (${p.arpa}) | ${ERR[p.error!.type]} | ${p.error!.heardIpa ? '/' + p.error!.heardIpa + '/' : '—'} | ${p.score} | ${f2(p.gop.lpr)} / ${p.gop.ctc !== undefined ? f2(p.gop.ctc) : '—'} |`);
    L.push('');
  }
  const fl = r.fluency;
  L.push('## 流利度与语速');
  L.push('');
  L.push(`- 有效朗读时间 ${f2(fl.speakingTime)} s（${t(fl.speechStart)}–${t(fl.speechEnd)}），发音时间（去除停顿）${f2(fl.articulationTime)} s`);
  L.push(`- 语速 ${fl.wordsPerMinute} 词/分；${f2(fl.syllablesPerSecond)} 音节/秒；发音速度 ${f2(fl.articulationRate)} 音节/秒（母语者朗读约 4–5.5）`);
  L.push(`- 停顿 ${fl.pauseCount} 次（不自然 ${fl.disfluentPauseCount} 次，≥1 秒 ${fl.longPauseCount} 次），停顿占比 ${(fl.pauseRatio * 100).toFixed(0)}%，最长 ${f2(fl.longestPause)} s，平均语流长度 ${f1(fl.meanLengthOfRun)} 音节；多余声音/填充 ${fl.fillerCount} 处`);
  if (fl.pauses.length) {
    L.push('');
    L.push('| 位置（在该词之后） | 开始 | 时长 | 类型 | 是否影响流利 |');
    L.push('|---|---|---|---|---|');
    for (const p of fl.pauses) L.push(`| ${r.words[p.afterWord]?.text ?? ''} | ${t(p.start)} | ${f2(p.duration)} s | ${p.kind === 'boundary' ? '标点/意群处' : p.kind === 'filler' ? '有填充声' : '意群内部'} | ${p.disfluent ? '是' : '否'} |`);
  }
  L.push('');
  const pr = r.prosody;
  L.push('## 韵律（重音、节奏、语调）');
  L.push('');
  L.push(`- 基频中位数 ${pr.f0MedianHz} Hz；音高变化范围（10%–90% 分位）${f1(pr.pitchRangeSt)} 半音，标准差 ${f2(pr.pitchSdSt)} 半音${pr.monotone ? '（偏单调）' : ''}`);
  L.push(`- 元音时长成对变异指数 nPVI ${f1(pr.nPVI)}（英语母语朗读通常约 55–70，音节计时倾向的口音偏低）；实词−虚词突显度差 ${f2(pr.contentFunctionDiff)}`);
  L.push(`- 多音节词重音正确率 ${(pr.stressAccuracy * 100).toFixed(0)}%`);
  for (const it of pr.intonation) L.push(`- 第 ${it.sentence + 1} 句（${it.type}）句尾：期望 ${it.expected}，检测到 ${it.detected}（${it.slopeSt} 半音）${it.ok ? '✓' : '✗'}`);
  L.push('');
  if (r.vowels.length) {
    L.push('## 元音共振峰（F1/F2，Hz，LPC 估计，仅供参考）');
    L.push('');
    L.push(r.vowels.map((v) => `${r.words[v.word].text}:${v.arpa} F1=${v.f1} F2=${v.f2} (${v.score})`).join('；'));
    L.push('');
  }
  L.push('## 音素识别序列（与原文无关的自由识别，ARPABET）');
  L.push('');
  L.push(r.recognized.map((x) => `${x.arpa}@${f2(x.start)}`).join(' '));
  L.push('');
  L.push('## 指标说明');
  L.push('');
  L.push('- 音素/单词/句子评分由本地声学模型给出的发音优度（GOP）等特征经回归模型映射得到，回归模型在 speechocean762 训练集（2500 句中国学习者英语朗读，专家人工评分）上训练，并在独立测试集上验证；与人工评分的相关系数见 analysis.json 的 engine.scoringMetrics。');
  L.push('- LPR：对齐模型的对数后验比（≤0，越接近 0 越像目标音素）；CTC-GOP：多语种音素识别模型给出的“目标音素 vs 最佳替换/删除”对数似然差（>0 表示目标音素最可信，<0 表示更像其他音素）。');
  L.push('- 自动评测可能误判：口音、背景噪声、录音设备都会影响结果，请结合录音复核。');
  return L.join('\n');
}

export interface PromptOptions {
  withAudio: boolean;
  audioFile?: string;
  language: 'zh' | 'en';
  forExport: boolean;
}

export function analysisPrompt(r: AssessmentResult, o: PromptOptions): string {
  const L: string[] = [];
  L.push('你是一位资深的英语语音教练（熟悉 IPA、英美口音差异和中国学习者的常见发音问题）。');
  if (o.withAudio) {
    L.push(`我${o.forExport ? '上传了' : '附上了'}一段英语朗读录音${o.audioFile ? `（${o.audioFile}，压缩为 MP3，已尽量保留发音细节）` : ''}，以及本地传统评测系统对这段录音的完整分析数据。请先亲自听录音，再结合数据进行分析。`);
  } else {
    L.push(`我${o.forExport ? '上传了' : '提供了'}本地传统评测系统对一段英语朗读录音的完整分析数据（${o.forExport ? '若你无法收听音频，' : ''}你无法收听录音，只能依据这些数据）。`);
  }
  L.push('');
  L.push('分析数据包括：逐词与逐音素的时间戳、0–100 评分、错误类型、“听起来像”的音素、音素识别模型的实际转写、语速、停顿、重音、语调和元音共振峰等。评分已用中国学习者人工评分数据集校准，但仍可能误判。');
  L.push('');
  L.push('请完成：');
  L.push('1. 用 3–5 句话总结整体水平和最需要改进的 2–3 个方面。');
  L.push('2. 逐一解释主要发音错误：是什么问题、为什么会这样（如受母语迁移影响）、正确的口型/舌位/气流要领，以及一个可以立即练习的方法。');
  L.push('3. 分析流利度和韵律：停顿位置是否合理、语速、单词重音、句子重音与弱读、连读、句尾语调。');
  L.push('4. 给出针对性练习：最小对立词、包含问题音素的单词和短句（每项 3–6 个），以及跟读建议。');
  L.push('5. 若你判断某条自动评测结果可能有误，请明确指出并说明依据。');
  if (o.withAudio) L.push('6. 对每条结论注明来源：【听音】表示你直接听录音得出，【数据】表示依据传统评测数据，【两者】表示两者一致。若你的听感与数据不一致，请说明。');
  else L.push('6. 你的结论全部基于评测数据而非直接听音，请在开头注明“以下分析基于传统评测数据，未直接听取录音”。');
  L.push('');
  L.push(o.language === 'zh' ? '请用简体中文回答，英语示例保留英文并标注 IPA。使用 Markdown 分节。' : 'Answer in English with IPA for examples. Use Markdown sections.');
  if (o.forExport) {
    L.push('');
    L.push('附件说明：report.md 为可读报告（含全部指标），analysis.json 为完整结构化数据（字段说明见其中 schema_notes），reference.txt 为朗读原文' + (o.withAudio ? `，${o.audioFile ?? 'recording.mp3'} 为录音` : '') + '。');
  }
  return L.join('\n');
}

/** Compact JSON for the in-app AI request (drops bulky tracks). */
export function compactForAi(r: AssessmentResult) {
  return {
    text: r.text,
    accent: r.accent,
    mode: r.mode,
    durationSec: r.audio.durationSec,
    scores: r.scores,
    summary: r.summary,
    issues: r.issues.map((i) => ({ severity: i.severity, category: i.category, title: i.title, detail: i.detail })),
    words: r.words.map((w) => ({
      i: w.index,
      text: w.text,
      t: w.skipped ? null : [w.start, w.end],
      score: w.score,
      ipa: r.accent === 'us' ? w.ipaUS : w.ipaUK,
      heard: w.heard,
      stress: w.stress ? { expected: w.stress.expected + 1, detected: w.stress.detected + 1, correct: w.stress.correct } : undefined,
      pauseAfter: w.pauseAfter,
      phones: w.phones.map((p) => ({ ipa: p.ipa, t: p.start < 0 ? null : [p.start, p.end], score: p.score, error: p.error ? { type: p.error.type, heard: p.error.heardIpa, ...(p.error.confirmed ? { confirmed: true } : {}) } : undefined })),
      notes: w.notes.length ? w.notes : undefined,
    })),
    fluency: { ...r.fluency, pauses: r.fluency.pauses.map((p) => ({ after: r.words[p.afterWord]?.text, at: p.start, dur: p.duration, kind: p.kind, disfluent: p.disfluent })) },
    prosody: r.prosody,
    vowels: r.vowels.map((v) => ({ word: r.words[v.word].text, vowel: v.arpa, f1: v.f1, f2: v.f2, score: v.score })),
    speaker: r.speakerProfile,
  };
}

export const SCHEMA_NOTES = {
  scores: '0–100. overall/accuracy/fluency/prosody are regression outputs calibrated on speechocean762 expert ratings (×10); completeness = % of reference words detected; stress = % of multi-syllable words whose most prominent syllable matches the dictionary primary stress; intonation = % of sentences whose final pitch movement matches the sentence type.',
  'words[].phones[].score': '0–100 phone accuracy (speechocean762 0–2 scale × 50). ≥80 good, 60–79 fair, <60 poor (flagged as an error).',
  'words[].phones[].gop': 'lpp/lpr: mean log posterior / log posterior ratio from the 10 ms phone classifier (charsiu en_w2v2_fc_10ms) over the aligned segment; frameAcc: share of frames where the target phone is the arg-max; ctc: log P(canonical) − log P(best substitution or deletion) from the CTC phoneme recogniser (wav2vec2-lv-60-espeak-cv-ft); ctcPeak: peak posterior of the target phone inside the word.',
  'words[].phones[].error': 'type: substitution (heard = most likely produced phone), deletion, distortion (poor match without a clear substitute). confirmed = true when both acoustic models (frame classifier and CTC recognizer) independently heard the same substitute; such phones are capped at 79.',
  'words[].heard': 'free (text-independent) phoneme recognition of the word region, espeak IPA.',
  'words[].stress': 'syllables[].prominence combines z-scored vowel intensity, pitch and normalised duration.',
  fluency: 'times in seconds; pauses are gaps ≥ 0.15 s between words; boundary = after punctuation; disfluent = inside a phrase ≥ 0.3 s, filled, or very long.',
  prosody: 'pitchRangeSt: 10–90th percentile range in semitones; nPVI: normalised pairwise variability of vowel durations; intonation[]: sentence-final pitch movement (semitones).',
  tracks: 'f0 (Hz, 0 = unvoiced) and energyDb (dBFS) every 10 ms from the start of the recording.',
  recognized: 'arg-max phone runs from the 10 ms classifier, text-independent.',
};
