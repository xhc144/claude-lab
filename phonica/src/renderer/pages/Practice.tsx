import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AiAnalysis, AssessmentResult, HistoryEntry } from '../../shared/types.ts';
import { api, type TtsResult } from '../lib/api.ts';
import { Recorder } from '../lib/recorder.ts';
import { player } from '../lib/audio.ts';
import { useApp } from '../lib/store.tsx';
import { fmtClock, guessMode, rate, MODE_LABEL } from '../lib/format.ts';
import { ResultView } from '../components/ResultView.tsx';
import { LiveWave } from '../components/Charts.tsx';
import { Seg, Switch, Spinner } from '../components/ui.tsx';
import { IconMic, IconPause, IconPlay, IconStop, IconVolume, IconLoop, IconChevronL, IconChevronR, IconClose, IconBook } from '../components/icons.tsx';

const STAGES: Record<string, string> = { prepare: '准备音频', acoustic: '声学模型计算音素概率', align: '强制对齐单词与音素', verify: '音素识别校验（检测替换与漏读）', score: '计算发音评分', prosody: '分析音高、重音与语调', done: '完成' };
const DEFAULT_TEXT = 'I think the weather is very nice today, isn\'t it?';

interface Attempt {
  entry: HistoryEntry;
  result: AssessmentResult;
  audioUrl: string;
  ai: AiAnalysis[];
}

function splitSentences(text: string): string[] {
  const parts = text.replace(/\s+/g, ' ').match(/[^.!?]+[.!?]+["”’)]*|[^.!?]+$/g) ?? [];
  const out: string[] = [];
  for (const p of parts.map((x) => x.trim()).filter(Boolean)) {
    if (out.length && p.split(' ').length <= 2 && out[out.length - 1].split(' ').length < 14) out[out.length - 1] += ' ' + p;
    else out.push(p);
  }
  return out;
}

export function Practice() {
  const { settings, updateSettings, engine, practice, toast, bumpHistory, go } = useApp();
  const [text, setText] = useState(DEFAULT_TEXT);
  const [title, setTitle] = useState('');
  const [materialId, setMaterialId] = useState<string | undefined>();
  const [editing, setEditing] = useState(false);
  const [bySentence, setBySentence] = useState(false);
  const [idx, setIdx] = useState(0);
  const [showIpa, setShowIpa] = useState(true);
  const [ipa, setIpa] = useState<Array<{ token: number; text: string; ipa: string; punct: string }>>([]);
  const [accent, setAccent] = useState<'us' | 'uk'>(settings?.accent ?? 'us');
  const [speed, setSpeed] = useState(settings?.ttsSpeed ?? 1);
  const [tts, setTts] = useState<TtsResult | null>(null);
  const [ttsBusy, setTtsBusy] = useState(false);
  const [loopRef, setLoopRef] = useState(false);
  const [recState, setRecState] = useState<'idle' | 'rec' | 'paused' | 'analyzing'>('idle');
  const [levels, setLevels] = useState<number[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [stage, setStage] = useState<{ stage: string; frac: number } | null>(null);
  const [attempts, setAttempts] = useState<Record<string, Attempt[]>>({});
  const [shown, setShown] = useState<Attempt | null>(null);
  const [clip, setClip] = useState(false);
  const rec = useRef<Recorder | null>(null);
  const timer = useRef<number>(0);
  const silentFor = useRef(0);
  const [, tick] = useState(0);

  useEffect(() => { if (settings) { setAccent(settings.accent); setSpeed(settings.ttsSpeed); } }, [settings?.accent]);
  useEffect(() => {
    if (!practice) return;
    setText(practice.text);
    setTitle(practice.title ?? '');
    setMaterialId(practice.materialId);
    setIdx(0);
    setShown(null);
    setEditing(false);
    setBySentence(guessMode(practice.text) === 'passage');
  }, [practice?.nonce]);
  useEffect(() => player.on(() => tick((v) => v + 1)), []);

  const sentences = useMemo(() => splitSentences(text), [text]);
  const unit = bySentence ? sentences[Math.min(idx, sentences.length - 1)] ?? '' : text.trim();
  const mode = guessMode(unit);
  const unitAttempts = attempts[unit] ?? [];
  const voice = accent === 'us' ? settings?.voiceUS ?? 'af_heart' : settings?.voiceUK ?? 'bf_emma';

  useEffect(() => {
    setTts(null);
    setShown((s) => (s && s.result.text === unit ? s : null));
    if (!unit || !engine.ready) return;
    let alive = true;
    api.textIpa(unit, accent).then((r) => alive && setIpa(r)).catch(() => alive && setIpa([]));
    return () => { alive = false; };
  }, [unit, accent, engine.ready]);

  const playRef = useCallback(async () => {
    if (player.playing && player.tag === 'tts-ref') return player.stop();
    setTtsBusy(true);
    try {
      let t = tts;
      if (!t || (t as any).__speed !== speed || (t as any).__voice !== voice) {
        t = await api.tts(unit, voice, speed);
        (t as any).__speed = speed;
        (t as any).__voice = voice;
        setTts(t);
      }
      await player.play(t.url, { tag: 'tts-ref', loop: loopRef });
    } catch (e) {
      toast(`标准发音生成失败：${(e as Error).message}`, 'error');
    } finally {
      setTtsBusy(false);
    }
  }, [tts, unit, voice, speed, loopRef]);

  const start = async () => {
    if (!unit) return toast('请先输入要朗读的英文', 'error');
    if (!engine.ready) return toast(engine.error ? `评测引擎不可用：${engine.error}` : '评测引擎正在加载，请稍候…', 'error');
    player.stop();
    setClip(false);
    const r = new Recorder({
      deviceId: settings?.inputDeviceId,
      sampleRate: settings?.recordSampleRate,
      onLevel: (rms, peak) => {
        if (peak > 0.98) setClip(true);
        setLevels((l) => (l.length > 600 ? [...l.slice(-400), rms] : [...l, rms]));
        const auto = settings?.autoStopSilenceSec ?? 0;
        if (auto > 0 && r.duration > 1) {
          silentFor.current = rms < 0.008 ? silentFor.current + 2048 / r.sampleRate : 0;
          if (silentFor.current > auto) { silentFor.current = 0; void stop(); }
        }
      },
    });
    try {
      await r.start();
    } catch (e) {
      toast((e as Error).message, 'error');
      return;
    }
    rec.current = r;
    setLevels([]);
    setElapsed(0);
    silentFor.current = 0;
    setRecState('rec');
    window.clearInterval(timer.current);
    timer.current = window.setInterval(() => setElapsed(r.duration), 100);
  };

  const togglePause = () => {
    const r = rec.current;
    if (!r) return;
    if (r.isPaused) { r.resume(); setRecState('rec'); } else { r.pause(); setRecState('paused'); }
  };

  const cancel = () => {
    rec.current?.cancel();
    rec.current = null;
    window.clearInterval(timer.current);
    setRecState('idle');
  };

  const stop = async () => {
    const r = rec.current;
    if (!r) return;
    rec.current = null;
    window.clearInterval(timer.current);
    const { samples, sampleRate } = await r.stop();
    if (samples.length / sampleRate < 0.4) {
      setRecState('idle');
      return toast('录音太短了，请朗读完整内容后再停止。', 'error');
    }
    setRecState('analyzing');
    setStage({ stage: 'prepare', frac: 0.02 });
    const off = api.onProgress(setStage);
    try {
      const { entry, result } = await api.assess({ text: unit, accent, mode, samples, sampleRate, materialId });
      const a: Attempt = { entry, result, audioUrl: `phonica://record/${entry.id}/recording.wav`, ai: [] };
      setAttempts((m) => ({ ...m, [unit]: [...(m[unit] ?? []), a] }));
      setShown(a);
      bumpHistory();
    } catch (e) {
      toast(`评测失败：${(e as Error).message}`, 'error');
    } finally {
      off();
      setRecState('idle');
      setStage(null);
    }
  };

  // keyboard: space = record/stop, P = standard pronunciation
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement;
      if (tgt && (tgt.tagName === 'TEXTAREA' || tgt.tagName === 'INPUT' || tgt.tagName === 'SELECT')) return;
      if (document.querySelector('.drawer, .modal')) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (recState === 'idle') void start();
        else if (recState === 'rec' || recState === 'paused') void stop();
      } else if (e.key === 'p' || e.key === 'P') void playRef();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  const ttsWordIdx = (() => {
    if (!tts || !player.playing || player.src !== tts.url) return -1;
    const t = player.time;
    return tts.words.findIndex((w) => t >= w.start && t <= w.end + 0.05);
  })();

  const best = (s: string) => {
    const l = attempts[s];
    return l && l.length ? Math.max(...l.map((a) => a.result.scores.overall)) : null;
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>朗读练习</h1>
          <p>{title || '输入或粘贴任意英文，或从素材库选择'}{materialId ? '' : ''}</p>
        </div>
        <div className="actions">
          <Seg value={accent} onChange={(v) => { setAccent(v); void updateSettings({ accent: v }); }} options={[{ value: 'us', label: '美音' }, { value: 'uk', label: '英音' }]} />
          <button className="btn" onClick={() => go({ page: 'materials' })}><IconBook />素材库</button>
        </div>
      </div>

      <div className="practice">
        <div className="card pad">
          <div className="card-title">
            {editing ? '编辑朗读文本' : `朗读内容 · ${MODE_LABEL[mode]}`}
            {!editing && sentences.length > 1 && (
              <label className="row small" style={{ gap: 6, fontWeight: 400 }}><Switch on={bySentence} onChange={(v) => { setBySentence(v); setIdx(0); }} />逐句练习</label>
            )}
            <div className="right">
              {!editing && <label className="row small" style={{ gap: 6, fontWeight: 400 }}><Switch on={showIpa} onChange={setShowIpa} />显示音标</label>}
              <button className="btn sm" onClick={() => setEditing(!editing)}>{editing ? '完成' : '编辑文本'}</button>
            </div>
          </div>
          {editing ? (
            <div className="col">
              <textarea className="input" rows={6} value={text} onChange={(e) => { setText(e.target.value); setMaterialId(undefined); setTitle(''); }} placeholder="粘贴或输入英文单词、句子或文章…" autoFocus />
              <div className="row small muted">
                <span>{text.trim().split(/\s+/).filter(Boolean).length} 个单词 · {sentences.length} 句</span>
                <button className="btn sm right" onClick={async () => { const r = await api.importMaterial(); if (r) { setText(r.text); setTitle(r.title); setMaterialId(undefined); } }}>导入文件（txt / md / docx / 字幕）</button>
              </div>
            </div>
          ) : (
            <>
              {bySentence && (
                <div className="row" style={{ marginBottom: 10 }}>
                  <button className="btn sm icon" disabled={idx === 0} onClick={() => setIdx(idx - 1)}><IconChevronL /></button>
                  <div className="sent-nav">
                    {sentences.map((s, i) => {
                      const b = best(s);
                      return <button key={i} className={`${i === idx ? 'on' : ''} ${b === null ? '' : `done-${rate(b)}`}`} onClick={() => setIdx(i)} title={b === null ? s : `最佳 ${b} 分`}>{b === null ? i + 1 : b}</button>;
                    })}
                  </div>
                  <button className="btn sm icon" disabled={idx >= sentences.length - 1} onClick={() => setIdx(idx + 1)}><IconChevronR /></button>
                  <span className="small muted right">第 {idx + 1} / {sentences.length} 句</span>
                </div>
              )}
              <div className={`ref-text ${unit.length > 400 ? 'small' : ''}`}>
                {ipa.length ? ipa.map((t, i) => (
                  <span key={i}>
                    <span className={`tok ${ttsWordIdx >= 0 && tts?.words[ttsWordIdx]?.text === t.text && tts.words.slice(0, ttsWordIdx).filter((w) => w.text === t.text).length === ipa.slice(0, i).filter((x) => x.text === t.text).length ? 'current' : ''}`} onClick={() => api.tts(t.text, voice, Math.min(1, speed)).then((r) => player.play(r.url, { tag: 'tts-word' })).catch(() => undefined)} title="点击听这个词">
                      {t.text}
                      {showIpa && <span className="ipa-under">{t.ipa}</span>}
                    </span>{t.punct && <span className="muted">{t.punct}</span>}{' '}
                  </span>
                )) : <span>{unit}</span>}
              </div>
              <div className="row wrap" style={{ marginTop: 12, gap: 8 }}>
                <button className="btn" disabled={ttsBusy || !engine.ready} onClick={playRef}>{player.playing && player.tag === 'tts-ref' ? <IconStop /> : <IconVolume />}{ttsBusy ? '生成中…' : '标准发音'}</button>
                <select className="select" style={{ width: 170 }} value={voice} onChange={(e) => void updateSettings(accent === 'us' ? { voiceUS: e.target.value } : { voiceUK: e.target.value })}>
                  {(accent === 'us'
                    ? [['af_heart', 'Heart（女）'], ['af_bella', 'Bella（女）'], ['am_michael', 'Michael（男）'], ['am_fenrir', 'Fenrir（男）']]
                    : [['bf_emma', 'Emma（女）'], ['bf_isabella', 'Isabella（女）'], ['bm_george', 'George（男）'], ['bm_fable', 'Fable（男）']]
                  ).map(([v, l]) => <option key={v} value={v}>{accent === 'us' ? '美音 · ' : '英音 · '}{l}</option>)}
                </select>
                <span className="small muted">语速</span>
                <input type="range" min={0.5} max={1.5} step={0.05} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} style={{ width: 120 }} />
                <span className="small" style={{ width: 40 }}>{speed.toFixed(2)}×</span>
                <button className={`btn sm ${loopRef ? 'active' : ''}`} onClick={() => setLoopRef(!loopRef)}><IconLoop />循环</button>
                <span className="tiny muted right"><span className="kbd">空格</span> 开始/结束录音　<span className="kbd">P</span> 播放标准发音</span>
              </div>
            </>
          )}
        </div>

        <div className="card">
          {recState === 'analyzing' ? (
            <div className="analyzing">
              <Spinner />
              <div className="grow">
                <div style={{ fontWeight: 600 }}>正在评测…</div>
                <div className="small muted">{STAGES[stage?.stage ?? 'prepare'] ?? stage?.stage}</div>
                <div className="progress" style={{ marginTop: 8 }}><i style={{ width: `${Math.round((stage?.frac ?? 0) * 100)}%` }} /></div>
              </div>
            </div>
          ) : (
            <div className="recorder">
              <button className={`rec-btn ${recState !== 'idle' ? 'recording' : ''}`} onClick={() => (recState === 'idle' ? start() : stop())} title={recState === 'idle' ? '开始录音（空格）' : '结束并评测（空格）'}>
                {recState === 'idle' ? <IconMic /> : <span className="sq" />}
              </button>
              {recState === 'idle' ? (
                <div className="grow">
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{unitAttempts.length ? '再录一遍' : '点击开始录音'}</div>
                  <div className="small muted">
                    {engine.ready ? '先听标准发音，再大声、清楚地朗读。结束后会自动进行音素级评测。' : engine.error ? `评测引擎错误：${engine.error}` : '正在加载评测模型（首次启动约需数秒）…'}
                  </div>
                </div>
              ) : (
                <>
                  <LiveWave data={levels} />
                  <div className="col" style={{ gap: 4, alignItems: 'flex-end' }}>
                    <div className="timer">{fmtClock(elapsed)}</div>
                    {clip && <span className="chip poor">音量过大</span>}
                    {recState === 'paused' && <span className="chip fair">已暂停</span>}
                  </div>
                  <button className="btn icon" onClick={togglePause} title={recState === 'paused' ? '继续' : '暂停'}>{recState === 'paused' ? <IconPlay /> : <IconPause />}</button>
                  <button className="btn icon" onClick={cancel} title="放弃本次录音"><IconClose /></button>
                </>
              )}
            </div>
          )}
        </div>

        {unitAttempts.length > 1 && (
          <div className="card pad">
            <div className="card-title">本次练习的尝试 <span className="sub">同一内容的多次录音对比</span></div>
            <div className="row wrap" style={{ gap: 8 }}>
              {unitAttempts.map((a, i) => {
                const prev = unitAttempts[i - 1];
                const d = prev ? a.result.scores.overall - prev.result.scores.overall : 0;
                return (
                  <button key={a.entry.id} className={`btn ${shown?.entry.id === a.entry.id ? 'active' : ''}`} onClick={() => setShown(a)}>
                    第 {i + 1} 次 <b style={{ color: `var(--${rate(a.result.scores.overall)})` }}>{a.result.scores.overall}</b>
                    {prev && <span className="tiny" style={{ color: d >= 0 ? 'var(--good)' : 'var(--poor)' }}>{d >= 0 ? '+' : ''}{d}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {shown && shown.result.text === unit && (
          <ResultView key={shown.entry.id} recordId={shown.entry.id} result={shown.result} audioUrl={shown.audioUrl} ai={shown.ai} onRetry={() => void start()} />
        )}
        {shown && bySentence && idx < sentences.length - 1 && (
          <div className="row" style={{ justifyContent: 'center' }}>
            <button className="btn primary" onClick={() => setIdx(idx + 1)}>下一句<IconChevronR /></button>
          </div>
        )}
      </div>
    </div>
  );
}
