// Export (works without any AI) and in-app AI deep analysis.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { AiAnalysis, AssessmentResult, ExportOptions } from '../../shared/types.ts';
import { api } from '../lib/api.ts';
import { fmtBytes, fmtDate, uid } from '../lib/format.ts';
import { useApp } from '../lib/store.tsx';
import { Markdown } from '../lib/markdown.tsx';
import { Seg, Switch } from './ui.tsx';
import { IconCopy, IconDownload, IconFolder, IconSparkle, IconStop, IconTrash } from './icons.tsx';

const QUALITY: Array<{ label: string; bitrate: number; sampleRate: number; note: string }> = [
  { label: '极小', bitrate: 32, sampleRate: 16000, note: '32 kbps · 16 kHz，保留 8 kHz 以内频率，适合仅需语音内容' },
  { label: '高压缩（推荐）', bitrate: 64, sampleRate: 24000, note: '64 kbps · 24 kHz 单声道，保留约 11 kHz 频率，/s/ /θ/ 等摩擦音细节完整' },
  { label: '标准', bitrate: 96, sampleRate: 44100, note: '96 kbps · 44.1 kHz' },
  { label: '高音质', bitrate: 192, sampleRate: 48000, note: '192 kbps · 48 kHz' },
];

export function ExportPanel({ recordId, result }: { recordId: string; result: AssessmentResult }) {
  const { settings, toast } = useApp();
  const [kind, setKind] = useState<ExportOptions['kind']>('zip');
  const [q, setQ] = useState(() => Math.max(0, QUALITY.findIndex((x) => x.bitrate === settings?.exportBitrate)));
  const [includeRef, setIncludeRef] = useState(settings?.exportIncludeReference ?? false);
  const [est, setEst] = useState<{ mp3Bytes: number; wavBytes: number; durationSec: number } | null>(null);
  const [done, setDone] = useState<{ paths: string[]; bytes: number; audio: { bytes: number; kbps: number; sampleRate: number } | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const opts: ExportOptions = { kind, bitrate: QUALITY[q].bitrate, sampleRate: QUALITY[q].sampleRate, includeReference: includeRef };

  useEffect(() => {
    api.exportEstimate(recordId, opts).then(setEst).catch(() => setEst(null));
  }, [recordId, q]);

  const run = async () => {
    setBusy(true);
    setDone(null);
    try {
      const voice = result.accent === 'us' ? settings?.voiceUS : settings?.voiceUK;
      const r = await api.exportRun(recordId, opts, voice);
      if (r) {
        setDone(r);
        toast('导出完成', 'success');
      }
    } catch (e) {
      toast(`导出失败：${(e as Error).message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const copyPrompt = async () => {
    try {
      const report = await api.reportText(recordId);
      await navigator.clipboard.writeText(report);
      toast('完整文本报告已复制，可直接粘贴给 AI', 'success');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="notice">导出内容完全在本地生成，不需要任何 AI 接口。ZIP 包内含：高压缩录音 <b>recording.mp3</b>、朗读原文、可读报告 <b>report.md</b>、完整结构化数据 <b>analysis.json</b>（单词/音素时间戳、评分、错误、语速、停顿、重音、语调、共振峰）以及可直接使用的提示词 <b>prompt.md</b>。将它上传给 ChatGPT、Claude、Gemini 等即可获得进一步指导。</div>
      <div className="field">
        <label>导出内容</label>
        <Seg value={kind} onChange={setKind} options={[
          { value: 'zip', label: '完整 ZIP 包' },
          { value: 'audio', label: '仅音频 MP3' },
          { value: 'report', label: '仅报告 (MD)' },
          { value: 'json', label: '仅数据 (JSON)' },
          { value: 'prompt', label: '仅提示词' },
        ]} />
      </div>
      {(kind === 'zip' || kind === 'audio') && (
        <div className="field">
          <label>音频质量</label>
          <Seg value={q} onChange={setQ} options={QUALITY.map((x, i) => ({ value: i, label: x.label }))} />
          <div className="hint">{QUALITY[q].note}。原始录音（{est ? fmtBytes(est.wavBytes) : '—'}，无损 WAV）始终保存在本地，评测使用原始录音，导出压缩不影响评测精度。</div>
        </div>
      )}
      {kind === 'zip' && (
        <div className="row">
          <Switch on={includeRef} onChange={setIncludeRef} />
          <span>附带标准发音音频（reference.mp3，由本地 TTS 生成）</span>
        </div>
      )}
      <div className="kv">
        <div className="item"><div className="k">录音时长</div><div className="v">{result.audio.durationSec.toFixed(1)}<small>秒</small></div></div>
        {(kind === 'zip' || kind === 'audio') && <div className="item"><div className="k">预计音频大小</div><div className="v">{est ? fmtBytes(est.mp3Bytes) : '—'}</div></div>}
        {done && <div className="item"><div className="k">实际{done.paths.length > 1 ? '总' : '文件'}大小</div><div className="v">{fmtBytes(done.bytes)}</div></div>}
        {done?.audio && <div className="item"><div className="k">实际音频</div><div className="v">{fmtBytes(done.audio.bytes)}<small>{done.audio.kbps} kbps · {done.audio.sampleRate / 1000} kHz</small></div></div>}
      </div>
      <div className="row">
        <button className="btn primary" disabled={busy} onClick={run}><IconDownload />{busy ? '正在导出…' : '导出'}</button>
        <button className="btn" onClick={copyPrompt}><IconCopy />复制文本报告</button>
        {done && <button className="btn ghost" onClick={() => api.showItem(done.paths[0])}><IconFolder />在文件夹中显示</button>}
      </div>
      {done && <div className="tiny muted mono">{done.paths.join('\n')}</div>}
    </div>
  );
}

export function AiPanel({ recordId, result, initial }: { recordId: string; result: AssessmentResult; initial: AiAnalysis[] }) {
  const { settings, go, toast } = useApp();
  const providers = settings?.aiProviders ?? [];
  const [pid, setPid] = useState(settings?.aiActiveProvider ?? providers[0]?.id ?? '');
  const [list, setList] = useState<AiAnalysis[]>(initial);
  const [live, setLive] = useState('');
  const [running, setRunning] = useState<string | null>(null);
  const [error, setError] = useState('');
  const liveRef = useRef('');
  const prov = providers.find((p) => p.id === pid);
  const audioOk = !!prov && prov.kind !== 'anthropic' && prov.kind !== 'deepseek' && prov.audioInput;
  const configured = !!prov && (!!prov.apiKey || /localhost|127\.0\.0\.1/.test(prov.baseUrl));

  useEffect(() => setList(initial), [initial]);
  useEffect(() => api.onAiDelta((d) => {
    if (d.requestId !== running) return;
    liveRef.current += d.text;
    setLive(liveRef.current);
  }), [running]);

  const run = async () => {
    if (!prov) return;
    const rid = uid();
    liveRef.current = '';
    setLive('');
    setError('');
    setRunning(rid);
    try {
      const a = await api.aiRun(recordId, prov.id, rid);
      setList((l) => [a, ...l]);
      setLive('');
    } catch (e) {
      const msg = (e as Error).message;
      if (!/abort/i.test(msg)) setError(msg);
    } finally {
      setRunning(null);
    }
  };

  const del = async (a: AiAnalysis) => {
    await api.aiDelete(recordId, a.id);
    setList((l) => l.filter((x) => x.id !== a.id));
  };

  const sourceTag = useMemo(() => (withAudio: boolean) => withAudio
    ? <span className="ai-source audio">🎧 已直接听取录音 + 结合传统评测数据</span>
    : <span className="ai-source data">📊 仅基于传统评测数据分析（未听录音）</span>, []);

  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="notice">AI 分析是在本地传统评测之上的补充指导，可选使用。录音和数据只有在你点击“开始分析”后才会发送给所选 AI 服务。</div>
      {providers.length === 0 ? (
        <div className="notice warn">尚未配置 AI 服务。<a href="#" onClick={(e) => { e.preventDefault(); go({ page: 'settings' }); }}>前往设置</a></div>
      ) : (
        <div className="row wrap">
          <select className="select" style={{ width: 280 }} value={pid} onChange={(e) => setPid(e.target.value)}>
            {providers.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.model}{p.apiKey ? '' : '（未配置密钥）'}</option>)}
          </select>
          {prov && (audioOk ? <span className="chip good">该模型可接收音频：将发送 MP3 录音 + 评测数据</span> : <span className="chip accent">该模型不接收音频：仅发送评测数据</span>)}
          <div className="right row">
            {running ? (
              <button className="btn" onClick={() => api.aiCancel(running)}><IconStop />停止</button>
            ) : (
              <button className="btn primary" disabled={!configured} onClick={run}><IconSparkle />开始分析</button>
            )}
          </div>
        </div>
      )}
      {prov && !configured && <div className="notice warn">请先在“设置 → AI 服务”中为 {prov.name} 填写 API 密钥。</div>}
      {error && <div className="notice err">{error}</div>}
      {running && (
        <div className="card pad">
          <div className="row" style={{ marginBottom: 8 }}>{sourceTag(audioOk)}<span className="tiny muted right">{prov?.model} 正在分析…</span></div>
          {live ? <Markdown text={live} /> : <div className="muted small">等待模型响应…</div>}
          <span className="caret" />
        </div>
      )}
      {list.map((a) => (
        <div key={a.id} className="card pad">
          <div className="row" style={{ marginBottom: 6 }}>
            {sourceTag(a.withAudio)}
            <span className="tiny muted">{a.provider} · {a.model} · {fmtDate(a.createdAt)}{a.usage?.outputTokens ? ` · ${a.usage.inputTokens ?? '?'}→${a.usage.outputTokens} tokens` : ''}</span>
            <div className="right row" style={{ gap: 4 }}>
              <button className="btn sm ghost icon" title="复制" onClick={() => navigator.clipboard.writeText(a.content).then(() => toast('已复制', 'success'))}><IconCopy /></button>
              <button className="btn sm ghost icon" title="删除" onClick={() => del(a)}><IconTrash /></button>
            </div>
          </div>
          <Markdown text={a.content} />
        </div>
      ))}
      {!running && list.length === 0 && providers.length > 0 && <div className="empty small">还没有 AI 分析记录。{result.words.length > 0 ? '选择服务后点击“开始分析”。' : ''}</div>}
    </div>
  );
}
