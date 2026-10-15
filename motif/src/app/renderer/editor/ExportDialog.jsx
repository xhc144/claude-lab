// Export: video (MP4/WebM/MOV/GIF), PNG sequence, PDF handout, interactive HTML — rendered by the
// same engine in hidden windows, encoded with FFmpeg, with live progress and cancel.
import { useEffect, useState } from 'react';
import { Modal, Field, Segmented, Select, Progress, toast } from '../ui.jsx';
import { Icon } from '../icons.jsx';
import { editor, useEditor } from './store.js';
import { call, on, fmtBytes, fmtTime } from '../api.js';

const FORMATS = [
  { id: 'mp4', label: 'MP4 视频', icon: 'film', ext: 'mp4', desc: 'H.264，通用播放与社交平台' },
  { id: 'webm', label: 'WebM', icon: 'film', ext: 'webm', desc: 'VP9，网页嵌入' },
  { id: 'mov', label: 'MOV ProRes', icon: 'clapperboard', ext: 'mov', desc: '高质量母版，进一步剪辑' },
  { id: 'gif', label: 'GIF 动图', icon: 'image', ext: 'gif', desc: '短循环，聊天与文档' },
  { id: 'html', label: '交互演示 HTML', icon: 'monitor-play', ext: 'html', desc: '单文件离线播放，可翻页演示' },
  { id: 'pdf', label: 'PDF 讲义', icon: 'file-text', ext: 'pdf', desc: '每个场景一页，附备注' },
  { id: 'png', label: 'PNG 序列帧', icon: 'images', ext: '', desc: '逐帧图片，用于合成' },
];

export function ExportDialog({ onClose }) {
  const doc = useEditor((s) => s.doc);
  const timing = useEditor((s) => s.timing);
  const [fmt, setFmt] = useState(() => localStorage.getItem('motif.export.fmt') || 'mp4');
  const [quality, setQuality] = useState('high');
  const [res, setRes] = useState('full');
  const [fps, setFps] = useState(doc.format.fps);
  const [range, setRange] = useState('all');
  const [out, setOut] = useState('');
  const [job, setJob] = useState(null); // {jobId, done, total, result}
  const [info, setInfo] = useState(null);
  const f = FORMATS.find((x) => x.id === fmt);
  const isVideo = ['mp4', 'webm', 'mov', 'gif'].includes(fmt);

  useEffect(() => { call('app.info').then(setInfo).catch(() => {}); }, []);
  useEffect(() => {
    try { localStorage.setItem('motif.export.fmt', fmt); } catch { /* ignore */ }
    call('project.exportsDir', editor.project.id).then((dir) => {
      const name = doc.title.replace(/[\\/:*?"<>|]+/g, '_');
      const sep = dir.includes('\\') ? '\\' : '/';
      setOut(`${dir}${sep}${name}${f.ext ? '.' + f.ext : '-frames'}`);
    }).catch(() => {});
  }, [fmt]);

  useEffect(() => on('export', (ev) => {
    setJob((j) => {
      if (!j || ev.jobId !== j.jobId) return j;
      if (ev.finished) return { ...j, finished: true, result: ev };
      return { ...j, done: ev.done ?? j.done, total: ev.total ?? j.total };
    });
  }), []);

  const width = res === 'full' ? doc.format.width : res === 'half' ? Math.round(doc.format.width / 2) : res === '4k' ? doc.format.width * 2 : 720;
  const sc = timing.scenes.find((s) => s.id === editor.s.sel.scene);
  const start = async () => {
    await editor.flushNow();
    let target = out;
    if (!target) return;
    try {
      const r = await call('export.start', editor.project.id, {
        format: fmt, out: target, quality, fps, width: res === 'full' ? undefined : width,
        range: range === 'scene' && sc ? [sc.start, sc.end] : undefined,
      });
      setJob({ jobId: r.jobId, done: 0, total: 0, started: Date.now() });
    } catch (e) { toast.error(e); }
  };
  const browse = async () => {
    const p = await call('dialog.save', { defaultPath: out, filters: f.ext ? [{ name: f.label, extensions: [f.ext] }] : undefined });
    if (p) setOut(p);
  };

  const running = job && !job.finished;
  const result = job?.result;
  const pct = job?.total ? job.done / job.total : 0;
  const elapsed = job ? (Date.now() - job.started) / 1000 : 0;
  const eta = pct > 0.03 ? elapsed / pct - elapsed : null;
  const dur = range === 'scene' && sc ? sc.duration : timing.duration;

  return (
    <Modal title="导出" sub={`${doc.title} · ${fmtTime(timing.duration)} · ${doc.format.width}×${doc.format.height}`} icon="download" onClose={running ? undefined : onClose} closeOnBackdrop={!running} width={640}
      footer={result ? (
        <>
          {result.ok ? <button className="btn" onClick={() => call('shell.reveal', result.out || out)}><Icon name="folder-open" size={14} />在文件夹中显示</button> : null}
          {result.ok && fmt !== 'png' ? <button className="btn" onClick={() => call('shell.open', result.out || out)}><Icon name="play" size={14} />打开</button> : null}
          <div className="spacer" />
          <button className="btn" onClick={() => setJob(null)}>再导出一个</button>
          <button className="btn primary" onClick={onClose}>完成</button>
        </>
      ) : running ? (
        <><div className="spacer" /><button className="btn danger" onClick={() => call('export.cancel', job.jobId)}><Icon name="circle-stop" size={14} />取消</button></>
      ) : (
        <><div className="spacer" /><button className="btn" onClick={onClose}>取消</button><button className="btn primary" onClick={start} disabled={isVideo && info && !info.ffmpeg}><Icon name="download" size={14} />开始导出</button></>
      )}>
      {!job ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 14 }}>
            {FORMATS.map((x) => (
              <button key={x.id} className={`chip ${fmt === x.id ? 'on' : ''}`} style={{ height: 64, flexDirection: 'column', justifyContent: 'center', borderRadius: 10, gap: 4 }} title={x.desc} onClick={() => setFmt(x.id)}>
                <Icon name={x.icon} size={17} /><span>{x.label}</span>
              </button>
            ))}
          </div>
          <div className="dim" style={{ marginBottom: 10 }}>{f.desc}</div>
          {isVideo || fmt === 'png' ? (
            <>
              <Field label="分辨率"><Segmented value={res} options={[{ value: '720', label: '720p' }, { value: 'half', label: '½' }, { value: 'full', label: `原始 ${doc.format.width}` }, { value: '4k', label: '2×' }]} onChange={setRes} /></Field>
              {fmt !== 'gif' ? <Field label="帧率"><Segmented value={fps} options={[24, 25, 30, 60].map((v) => ({ value: v, label: String(v) }))} onChange={setFps} /></Field> : null}
              {fmt !== 'png' && fmt !== 'gif' ? <Field label="质量"><Segmented value={quality} options={[{ value: 'small', label: '小文件' }, { value: 'standard', label: '标准' }, { value: 'high', label: '高质量' }]} onChange={setQuality} /></Field> : null}
              <Field label="范围"><Segmented value={range} options={[{ value: 'all', label: '全部' }, { value: 'scene', label: sc ? `当前场景（${sc.index + 1}）` : '当前场景' }]} onChange={setRange} /></Field>
            </>
          ) : null}
          {fmt === 'pdf' ? <div className="dim">每个场景在动画完成后的画面作为一页（1600px 宽）。</div> : null}
          {fmt === 'html' ? <div className="dim">字体与图片内嵌，单个文件即可离线播放；方向键翻页，F 全屏。</div> : null}
          <Field label="保存到">
            <div className="row" style={{ gap: 6 }}>
              <input className="input mono" value={out} onChange={(e) => setOut(e.target.value)} />
              <button className="btn" onClick={browse}>浏览…</button>
            </div>
          </Field>
          {isVideo && info && !info.ffmpeg ? <div className="ai-step err" style={{ marginTop: 8 }}><Icon name="triangle-alert" size={14} />未找到 FFmpeg。请在 设置 → 常规 中指定 ffmpeg 路径。</div> : null}
          {isVideo ? <div className="dim" style={{ marginTop: 8, fontSize: 11.5 }}>约 {Math.round(dur * fps)} 帧{info ? `，将使用 ${Math.max(1, Math.min(6, info.cpus - 1))} 个并行渲染进程` : ''}。音乐与视频片段的声音会自动混入。</div> : null}
        </>
      ) : (
        <div className="col" style={{ gap: 12, padding: '10px 0' }}>
          {!result ? (
            <>
              <div className="row"><b style={{ color: 'var(--fg0)' }} className="grow">正在导出 {f.label}…</b><span className="mono dim">{job.total ? `${job.done} / ${job.total} 帧` : '准备中'}</span></div>
              <Progress value={pct} indeterminate={!job.total} />
              <div className="dim">{eta != null ? `预计剩余 ${Math.ceil(eta)} 秒` : '正在加载字体与素材…'}</div>
            </>
          ) : result.ok ? (
            <div className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
              <span style={{ color: 'var(--ok)' }}><Icon name="circle-check" size={28} /></span>
              <div className="grow">
                <b style={{ color: 'var(--fg0)', fontSize: 14 }}>导出完成</b>
                <div className="mono dim" style={{ wordBreak: 'break-all', marginTop: 4 }}>{result.out || out}</div>
                <div className="dim" style={{ marginTop: 4 }}>{[result.bytes ? fmtBytes(result.bytes) : null, result.frames ? `${result.frames} 帧` : null, result.pages ? `${result.pages} 页` : null, result.seconds ? `用时 ${result.seconds.toFixed(1)} 秒` : null].filter(Boolean).join(' · ')}</div>
              </div>
            </div>
          ) : (
            <div className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
              <span style={{ color: result.cancelled ? 'var(--fg2)' : 'var(--err)' }}><Icon name={result.cancelled ? 'circle-stop' : 'circle-x'} size={28} /></span>
              <div className="grow"><b style={{ color: 'var(--fg0)' }}>{result.cancelled ? '已取消' : '导出失败'}</b><div className="dim" style={{ marginTop: 4 }}>{result.error}</div></div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
