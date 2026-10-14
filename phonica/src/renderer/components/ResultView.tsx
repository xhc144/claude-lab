// The assessment result: scores, annotated text, timeline/spectrogram/vowel
// analysis, fluency and prosody, issues, word table, AI analysis and export.
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import type { AiAnalysis, AssessmentResult } from '../../shared/types.ts';
import { ScoreRing, Metric, Tabs, Seg, Switch } from './ui.tsx';
import { Timeline, type RefPitch } from './Timeline.tsx';
import { Spectrogram, VowelChart } from './Charts.tsx';
import { WordDrawer } from './WordDrawer.tsx';
import { ExportPanel, AiPanel } from './ExportAi.tsx';
import { IconPlay, IconStop, IconVolume, IconRefresh, IconSparkle, IconDownload } from './icons.tsx';
import { api, type TtsResult } from '../lib/api.ts';
import { loadAudio, player } from '../lib/audio.ts';
import { rate, fmtTime, MODE_LABEL } from '../lib/format.ts';
import { useApp } from '../lib/store.tsx';

type Tab = 'timeline' | 'spectrum' | 'vowels' | 'fluency' | 'issues' | 'words' | 'ai' | 'export';

export function ResultView({ recordId, result, audioUrl, ai, onRetry, compact }: { recordId: string; result: AssessmentResult; audioUrl: string; ai: AiAnalysis[]; onRetry?: () => void; compact?: boolean }) {
  const { settings, toast } = useApp();
  const [tab, setTab] = useState<Tab>('timeline');
  const [buffer, setBuffer] = useState<AudioBuffer | null>(null);
  const [blobUrl, setBlobUrl] = useState('');
  const [sel, setSel] = useState<number | null>(null);
  const [zoom, setZoom] = useState(0);
  const [showPitch, setShowPitch] = useState(true);
  const [showEnergy, setShowEnergy] = useState(true);
  const [showPhones, setShowPhones] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [ref, setRef] = useState<(TtsResult & { f0?: number[] }) | null>(null);
  const [refBusy, setRefBusy] = useState(false);
  const [showRef, setShowRef] = useState(false);
  const [specMax, setSpecMax] = useState(8000);
  const [specRange, setSpecRange] = useState(70);
  const [showFormants, setShowFormants] = useState(true);
  const [, tick] = useState(0);
  const tag = `rec:${recordId}`;

  useEffect(() => {
    let alive = true;
    setBuffer(null);
    loadAudio(audioUrl).then((a) => { if (alive) { setBuffer(a.buffer); setBlobUrl(a.blobUrl); } }).catch((e) => toast(`无法加载录音：${e.message}`, 'error'));
    return () => { alive = false; };
  }, [audioUrl]);
  useEffect(() => player.on(() => tick((v) => v + 1)), []);
  useEffect(() => () => { if (player.tag.startsWith(tag)) player.stop(); }, [tag]);

  const voice = result.accent === 'us' ? settings?.voiceUS ?? 'af_heart' : settings?.voiceUK ?? 'bf_emma';
  const loadRef = useCallback(async () => {
    if (ref) return ref;
    setRefBusy(true);
    try {
      const r = await api.tts(result.text, voice, settings?.ttsSpeed ?? 1);
      setRef(r);
      return r;
    } catch (e) {
      toast(`标准发音生成失败：${(e as Error).message}`, 'error');
      return null;
    } finally {
      setRefBusy(false);
    }
  }, [ref, result.text, voice, settings?.ttsSpeed]);

  const src = blobUrl || audioUrl;
  const playingMine = player.playing && player.src === src && player.tag === tag;
  const playingRef = player.playing && !!ref && player.src === ref.url;
  const refPitch: RefPitch | null = showRef && ref?.f0 ? { f0: ref.f0, words: ref.words } : null;
  const s = result.scores;
  const lvl = rate(s.overall);

  const counts = useMemo(() => ({
    issues: result.issues.length,
    bad: result.words.filter((w) => w.rating === 'poor' || w.rating === 'missing').length,
  }), [result]);

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="card result-head">
        <ScoreRing score={s.overall} />
        <div className="metrics">
          <Metric label="准确度" value={s.accuracy} hint="音素与单词发音的准确程度" />
          <Metric label="流利度" value={s.fluency} hint="语速、停顿、连贯程度" />
          <Metric label="完整度" value={s.completeness} hint="读出的单词占原文的比例" />
          <Metric label="韵律" value={s.prosody} hint="重音、节奏与语调" />
          <div className="row small muted" style={{ gap: 16, marginTop: 2 }}>
            <span>单词重音 <b style={{ color: 'var(--text)' }}>{s.stress === null ? '—' : `${s.stress}%`}</b></span>
            <span>句尾语调 <b style={{ color: 'var(--text)' }}>{s.intonation === null ? '—' : `${s.intonation}%`}</b></span>
            <span>语速 <b style={{ color: 'var(--text)' }}>{result.fluency.wordsPerMinute}</b> 词/分</span>
            <span>时长 <b style={{ color: 'var(--text)' }}>{fmtTime(result.audio.durationSec)}</b></span>
          </div>
        </div>
        <div className="summary">
          <span className={`chip ${lvl === 'missing' ? '' : lvl}`} style={{ fontSize: 13, height: 28, padding: '0 12px' }}>{result.summary.level} · {MODE_LABEL[result.mode]} · {result.accent === 'us' ? '美音' : '英音'}</span>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn" onClick={() => (playingMine ? player.stop() : player.play(src, { tag, rate: speed }))}>{playingMine ? <IconStop /> : <IconPlay />}我的录音</button>
            <button className="btn" disabled={refBusy} onClick={async () => { if (playingRef) return player.stop(); const r = await loadRef(); if (r) void player.play(r.url, { tag: 'tts-ref', rate: speed }); }}>{playingRef ? <IconStop /> : <IconVolume />}{refBusy ? '生成中…' : '标准发音'}</button>
            {onRetry && <button className="btn primary" onClick={onRetry}><IconRefresh />再读一遍</button>}
          </div>
          <div className="row small" style={{ gap: 6 }}>
            <span className="muted">播放速度</span>
            <Seg value={speed} onChange={(v) => { setSpeed(v); player.setRate(v); }} options={[0.6, 0.8, 1, 1.25].map((v) => ({ value: v, label: `${v}×` }))} />
          </div>
        </div>
      </div>

      <div className="card pad">
        <div className="card-title">逐词评测 <span className="sub">点击单词查看音标、录音片段、音素评分与纠正方法</span>
          <div className="right legend"><span><i style={{ background: 'var(--good)' }} />良好 ≥80</span><span><i style={{ background: 'var(--fair)' }} />一般 60–79</span><span><i style={{ background: 'var(--poor)' }} />需改进 &lt;60</span><span><i style={{ background: 'var(--missing)' }} />漏读</span></div>
        </div>
        <Annotated result={result} sel={sel} playingTag={player.playing && player.src === src ? player.tag : ''} onPick={(i) => { setSel(i); const w = result.words[i]; if (!w.skipped) void player.play(src, { tag: `${tag}:w${i}`, start: Math.max(0, w.start - 0.03), end: w.end + 0.05, rate: speed }); }} tag={tag} />
        {result.summary.focus.length > 0 && (
          <div className="row wrap" style={{ gap: 6, marginTop: 12 }}>
            <span className="small muted">重点改进：</span>
            {result.summary.focus.map((f, i) => <span key={i} className="chip fair">{f}</span>)}
            {result.summary.strengths.map((f, i) => <span key={`s${i}`} className="chip good">{f}</span>)}
          </div>
        )}
      </div>

      {result.sentences.length > 1 && (
        <div className="card pad">
          <div className="card-title">逐句得分 <span className="sub">长文按句评分后按词数加权汇总；点击播放该句</span></div>
          <table className="tbl">
            <thead><tr><th>#</th><th>句子</th><th>总分</th><th>准确</th><th>流利</th><th>韵律</th><th></th></tr></thead>
            <tbody>
              {result.sentences.map((st) => (
                <tr key={st.index} className="click" onClick={() => st.end > st.start && player.play(src, { tag: `${tag}:s${st.index}`, start: Math.max(0, st.start - 0.1), end: st.end + 0.15, rate: speed })}>
                  <td className="muted">{st.index + 1}</td>
                  <td style={{ maxWidth: 560 }}>{st.text}</td>
                  <td><span className={`chip ${rate(st.score)}`}>{st.score}</span></td>
                  <td>{st.scores?.accuracy ?? '—'}</td>
                  <td>{st.scores?.fluency ?? '—'}</td>
                  <td>{st.scores?.prosody ?? '—'}</td>
                  <td>{player.playing && player.tag === `${tag}:s${st.index}` ? <IconStop style={{ width: 14 }} /> : <IconPlay style={{ width: 14 }} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card pad">
        <Tabs value={tab} onChange={setTab} tabs={[
          { id: 'timeline', label: '波形与音高' },
          { id: 'spectrum', label: '语谱图' },
          { id: 'vowels', label: '元音图', badge: result.vowels.length || null },
          { id: 'fluency', label: '流利度与韵律' },
          { id: 'issues', label: '问题与建议', badge: counts.issues || null },
          { id: 'words', label: '单词明细' },
          { id: 'ai', label: <><IconSparkle style={{ width: 14, height: 14, verticalAlign: -2, marginRight: 4 }} />AI 深度分析</>, badge: ai.length || null },
          { id: 'export', label: <><IconDownload style={{ width: 14, height: 14, verticalAlign: -2, marginRight: 4 }} />导出</> },
        ]} />
        {(tab === 'timeline' || tab === 'spectrum') && (
          <div className="timeline-tools">
            <span className="small muted">缩放</span>
            <input type="range" min={0} max={600} step={10} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} style={{ width: 160 }} />
            <span className="tiny muted">{zoom === 0 ? '适应宽度' : `${zoom} px/s`}</span>
            {tab === 'timeline' ? (
              <>
                <label className="row small" style={{ gap: 6 }}><Switch on={showPitch} onChange={setShowPitch} />音高</label>
                <label className="row small" style={{ gap: 6 }}><Switch on={showEnergy} onChange={setShowEnergy} />能量</label>
                <label className="row small" style={{ gap: 6 }}><Switch on={showPhones} onChange={setShowPhones} />音素</label>
                <label className="row small" style={{ gap: 6 }}><Switch on={showRef} onChange={async (v) => { setShowRef(v); if (v) await loadRef(); }} />叠加标准语调{refBusy ? '（生成中）' : ''}</label>
                <span className="legend"><span><i style={{ background: 'var(--pitch)' }} />你的音高</span>{showRef && <span><i style={{ background: 'var(--pitch-ref)' }} />标准音高</span>}</span>
              </>
            ) : (
              <>
                <span className="small muted">频率上限</span>
                <Seg value={specMax} onChange={setSpecMax} options={[4000, 6000, 8000].map((v) => ({ value: v, label: `${v / 1000}k` }))} />
                <span className="small muted">动态范围</span>
                <Seg value={specRange} onChange={setSpecRange} options={[50, 70, 90].map((v) => ({ value: v, label: `${v} dB` }))} />
                <label className="row small" style={{ gap: 6 }}><Switch on={showFormants} onChange={setShowFormants} />元音共振峰</label>
              </>
            )}
          </div>
        )}
        {tab === 'timeline' && <Timeline result={result} buffer={buffer} audioUrl={src} tag={tag} zoom={zoom} showPitch={showPitch} showEnergy={showEnergy} showPhones={showPhones} reference={refPitch} selected={sel} onSelect={setSel} rateSpeed={speed} />}
        {tab === 'timeline' && <div className="tiny muted" style={{ marginTop: 8 }}>点击单词播放该词，点击其他位置从该处播放；红色阴影为不自然停顿。音高以半音表示（相对你的平均音高 {result.prosody.f0MedianHz} Hz），打开“叠加标准语调”可与标准发音的语调曲线逐词对比。</div>}
        {tab === 'spectrum' && <Spectrogram result={result} buffer={buffer} audioUrl={src} tag={tag} maxHz={specMax} dynRange={specRange} showFormants={showFormants} zoom={zoom} />}
        {tab === 'spectrum' && <div className="tiny muted" style={{ marginTop: 8 }}>语谱图显示声音在各频率上的能量。/s/ /ʃ/ 等摩擦音在 4 kHz 以上有强能量，/θ/ /f/ 较弱且分散；元音的横向亮带为共振峰（蓝线 F1，绿线 F2）。</div>}
        {tab === 'vowels' && (result.vowels.length ? <VowelChart result={result} onPick={setSel} /> : <div className="empty">本次朗读中没有足够长的单元音用于共振峰分析。</div>)}
        {tab === 'fluency' && <FluencyPanel result={result} />}
        {tab === 'issues' && <IssuesPanel result={result} onPick={setSel} />}
        {tab === 'words' && <WordsTable result={result} onPick={setSel} />}
        {tab === 'ai' && <AiPanel recordId={recordId} result={result} initial={ai} />}
        {tab === 'export' && <ExportPanel recordId={recordId} result={result} />}
      </div>

      {!compact && (
        <div className="tiny muted" style={{ textAlign: 'center' }}>
          评测引擎：{result.engine.acousticModel}；{result.engine.scoring}{result.engine.scoringMetrics.phone_pcc ? `（与人工评分相关系数：音素 ${result.engine.scoringMetrics.phone_pcc}，单词 ${result.engine.scoringMetrics.word_pcc}，句子总分 ${result.engine.scoringMetrics.sentence_total_pcc}）` : ''} · 分析用时 {(result.engine.analysisMs / 1000).toFixed(1)} 秒
        </div>
      )}

      {sel !== null && result.words[sel] && (
        <WordDrawer result={result} word={result.words[sel]} audioUrl={src} tag={tag} onClose={() => setSel(null)} onNav={(d) => setSel((v) => (v === null ? 0 : Math.max(0, Math.min(result.words.length - 1, v + d))))} refWords={ref?.words} refUrl={ref?.url} />
      )}
    </div>
  );
}

function Annotated({ result, sel, onPick, playingTag, tag }: { result: AssessmentResult; sel: number | null; onPick: (i: number) => void; playingTag: string; tag: string }) {
  const pauseAfter = new Map(result.fluency.pauses.map((p) => [p.afterWord, p]));
  return (
    <div className="annot selectable">
      {result.tokens.map((t) => (
        <Fragment key={t.index}>
          {t.words.map((wi, k) => {
            const w = result.words[wi];
            const r = w.skipped ? 'missing' : rate(w.score);
            const p = pauseAfter.get(wi);
            const label = t.words.length > 1 ? w.spoken : t.text;
            return (
              <Fragment key={wi}>
                <span className={`w ${r} ${sel === wi ? 'sel' : ''} ${playingTag === `${tag}:w${wi}` ? 'playing' : ''}`} onClick={() => onPick(wi)} title={w.skipped ? '未读' : `${w.score} 分`}>
                  {label}
                  {w.stress && !w.stress.correct && !w.isFunction && <span className="stress-x" title="重音位置不对">ˈ</span>}
                  <span className="sc">{w.skipped ? '漏' : w.score}</span>
                </span>
                {k === t.words.length - 1 && t.punctAfter && <span className="punct">{t.punctAfter}</span>}
                {p && <span className={`pause-mark ${p.disfluent ? 'bad' : ''}`} title={`停顿 ${p.duration.toFixed(2)} 秒`}>‖{p.duration >= 0.3 ? p.duration.toFixed(1) : ''}</span>}{' '}
              </Fragment>
            );
          })}
        </Fragment>
      ))}
    </div>
  );
}

function FluencyPanel({ result }: { result: AssessmentResult }) {
  const f = result.fluency;
  const p = result.prosody;
  const rateNote = f.articulationRate < 2.8 ? '偏慢' : f.articulationRate > 6.2 ? '偏快' : '正常';
  return (
    <div className="col" style={{ gap: 18 }}>
      <div>
        <div className="card-title">流利度</div>
        <div className="kv">
          <div className="item"><div className="k">语速</div><div className="v">{f.wordsPerMinute}<small>词/分</small></div></div>
          <div className="item"><div className="k">发音速度（去除停顿）</div><div className="v">{f.articulationRate}<small>音节/秒 · {rateNote}</small></div></div>
          <div className="item"><div className="k">停顿次数</div><div className="v">{f.pauseCount}<small>不自然 {f.disfluentPauseCount}</small></div></div>
          <div className="item"><div className="k">停顿占比</div><div className="v">{Math.round(f.pauseRatio * 100)}<small>%</small></div></div>
          <div className="item"><div className="k">最长停顿</div><div className="v">{f.longestPause.toFixed(2)}<small>秒</small></div></div>
          <div className="item"><div className="k">平均语流长度</div><div className="v">{f.meanLengthOfRun}<small>音节</small></div></div>
          <div className="item"><div className="k">多余声音 / 填充</div><div className="v">{f.fillerCount}<small>处</small></div></div>
          <div className="item"><div className="k">有效朗读时间</div><div className="v">{f.speakingTime.toFixed(1)}<small>秒</small></div></div>
        </div>
        {f.pauses.length > 0 && (
          <table className="tbl" style={{ marginTop: 12 }}>
            <thead><tr><th>位置</th><th>时间</th><th>时长</th><th>类型</th><th>评价</th></tr></thead>
            <tbody>
              {f.pauses.map((x, i) => (
                <tr key={i}>
                  <td>“{result.words[x.afterWord]?.text}” 之后</td>
                  <td>{x.start.toFixed(2)} s</td>
                  <td>{x.duration.toFixed(2)} s</td>
                  <td>{x.kind === 'boundary' ? '标点 / 意群处' : x.kind === 'filler' ? '有填充声（嗯/呃）' : '意群内部'}</td>
                  <td>{x.disfluent ? <span className="chip poor">影响流利</span> : <span className="chip good">自然</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div>
        <div className="card-title">韵律</div>
        <div className="kv">
          <div className="item"><div className="k">平均音高</div><div className="v">{p.f0MedianHz}<small>Hz</small></div></div>
          <div className="item"><div className="k">音高变化范围</div><div className="v">{p.pitchRangeSt}<small>半音{p.monotone ? ' · 偏平淡' : ''}</small></div></div>
          <div className="item"><div className="k">单词重音正确率</div><div className="v">{Math.round(p.stressAccuracy * 100)}<small>%</small></div></div>
          <div className="item" title="元音时长成对变异指数：英语母语朗读约 55–70，越低越像“一字一顿”"><div className="k">节奏 nPVI</div><div className="v">{p.nPVI}</div></div>
          <div className="item" title="实词与虚词的突显度差异：越大说明虚词弱读越到位"><div className="k">实词−虚词突显差</div><div className="v">{p.contentFunctionDiff}</div></div>
        </div>
        {p.intonation.length > 0 && (
          <table className="tbl" style={{ marginTop: 12 }}>
            <thead><tr><th>句子</th><th>句型</th><th>期望句尾</th><th>检测到</th><th>音高变化</th><th></th></tr></thead>
            <tbody>
              {p.intonation.map((it) => (
                <tr key={it.sentence}>
                  <td style={{ maxWidth: 360 }}>{result.sentences[it.sentence]?.text}</td>
                  <td>{{ statement: '陈述句', 'wh-question': '特殊疑问句', 'yes-no-question': '一般疑问句', exclamation: '感叹句', fragment: '短语' }[it.type] ?? it.type}</td>
                  <td>{{ fall: '降调 ↘', rise: '升调 ↗', any: '均可' }[it.expected]}</td>
                  <td>{{ fall: '降调 ↘', rise: '升调 ↗', level: '平调 →', unknown: '无法判断' }[it.detected]}</td>
                  <td>{it.slopeSt > 0 ? '+' : ''}{it.slopeSt} 半音</td>
                  <td>{it.detected === 'unknown' ? '' : it.ok ? <span className="chip good">正确</span> : <span className="chip fair">需调整</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function IssuesPanel({ result, onPick }: { result: AssessmentResult; onPick: (i: number) => void }) {
  if (!result.issues.length) return <div className="empty">没有发现明显问题，继续保持！</div>;
  return (
    <div>
      {result.issues.map((i, k) => (
        <div key={k} className="issue">
          <div className={`sev ${i.severity}`} />
          <div>
            <h4>{i.title} <span className="badge">{{ high: '重要', medium: '中等', low: '轻微' }[i.severity]}</span></h4>
            <p>{i.detail}</p>
            {i.words && i.words.length > 0 && (
              <div className="row wrap" style={{ gap: 6, marginTop: 6 }}>
                {i.words.slice(0, 12).map((w) => <button key={w} className="btn sm" onClick={() => onPick(w)}>{result.words[w]?.text}</button>)}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function WordsTable({ result, onPick }: { result: AssessmentResult; onPick: (i: number) => void }) {
  return (
    <div style={{ maxHeight: 520, overflow: 'auto' }}>
      <table className="tbl">
        <thead><tr><th>#</th><th>单词</th><th>得分</th><th>标准音标</th><th>识别到</th><th>音素</th><th>时间</th><th>重音</th></tr></thead>
        <tbody>
          {result.words.map((w) => (
            <tr key={w.index} className="click" onClick={() => onPick(w.index)}>
              <td className="muted">{w.index + 1}</td>
              <td style={{ fontWeight: 600 }}>{w.text}</td>
              <td><span className={`chip ${w.skipped ? '' : rate(w.score)}`}>{w.skipped ? '漏读' : w.score}</span></td>
              <td className="ipa">/{result.accent === 'us' ? w.ipaUS : w.ipaUK}/</td>
              <td className="ipa muted">{w.heard ? `/${w.heard}/` : '—'}</td>
              <td className="ipa">{w.phones.map((p, i) => <span key={i} style={{ color: p.rating === 'good' ? undefined : p.rating === 'fair' ? 'var(--fair)' : 'var(--poor)', marginRight: 3 }}>{p.ipa}</span>)}</td>
              <td className="muted small">{w.skipped ? '—' : `${w.start.toFixed(2)}–${w.end.toFixed(2)}`}</td>
              <td>{w.stress ? (w.stress.correct ? '✓' : <span style={{ color: 'var(--fair)' }}>第{w.stress.expected + 1}音节</span>) : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


