// "录制屏幕": pick a screen, a window or an area, the microphone, system sound and webcam, then
// hand over to the floating recorder bar. After the recording is processed the new project opens
// in the recording editor (see RecordingStatus).
import { useEffect, useRef, useState } from 'react';
import { Modal, Field, Segmented, Select, Switch, Spinner, Progress, toast } from '../ui.jsx';
import { Icon } from '../icons.jsx';
import { call, on, platform } from '../api.js';

const PREF_KEY = 'motif.recorder';
const loadPrefs = () => { try { return JSON.parse(localStorage.getItem(PREF_KEY) || '{}'); } catch { return {}; } };

export function RecordDialog({ onClose, projectId }) {
  const p0 = loadPrefs();
  const [kind, setKind] = useState(p0.kind || 'screen');
  const [sources, setSources] = useState(null);
  const [sel, setSel] = useState(null);
  const [area, setArea] = useState(null);
  const [caps, setCaps] = useState(null);
  const [devices, setDevices] = useState({ mics: [], cams: [] });
  const [mic, setMic] = useState(p0.mic ?? 'default');
  const [cam, setCam] = useState(p0.camera ?? '');
  const [system, setSystem] = useState(p0.system ?? true);
  const [fps, setFps] = useState(p0.fps || 30);
  const [countdown, setCountdown] = useState(p0.countdown ?? 3);
  const [autoZoom, setAutoZoom] = useState(p0.autoZoom ?? true);
  const [hideCursor, setHideCursor] = useState(p0.hideCursor ?? true);
  const [busy, setBusy] = useState(false);
  const camRef = useRef(null);

  const refresh = () => call('recorder.sources').then((list) => {
    setSources(list);
    setSel((cur) => (list.some((s) => s.id === cur) ? cur : (list.find((s) => s.kind === 'screen' && s.display?.primary) || list.find((s) => s.kind === 'screen'))?.id || null));
  }).catch((e) => { toast.error(e); setSources([]); });
  useEffect(() => { refresh(); call('recorder.capabilities').then(setCaps).catch(() => {}); }, []);

  // devices (labels appear once media access was granted)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        let list = await navigator.mediaDevices.enumerateDevices();
        if (!list.some((d) => d.label)) {
          const s = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null);
          s?.getTracks().forEach((t) => t.stop());
          list = await navigator.mediaDevices.enumerateDevices();
        }
        if (!alive) return;
        setDevices({
          mics: list.filter((d) => d.kind === 'audioinput' && d.deviceId !== 'communications'),
          cams: list.filter((d) => d.kind === 'videoinput'),
        });
      } catch { /* no devices */ }
    })();
    return () => { alive = false; };
  }, []);

  // live webcam preview
  useEffect(() => {
    if (!cam) return undefined;
    let stream = null, stop = false;
    navigator.mediaDevices.getUserMedia({ video: { deviceId: cam === 'default' ? undefined : { exact: cam }, width: 320, height: 180 } })
      .then((s) => { if (stop) { s.getTracks().forEach((t) => t.stop()); return; } stream = s; if (camRef.current) camRef.current.srcObject = s; })
      .catch((e) => toast.error({ message: `摄像头不可用：${e.message}` }));
    return () => { stop = true; stream?.getTracks().forEach((t) => t.stop()); };
  }, [cam]);

  const screens = (sources || []).filter((s) => s.kind === 'screen');
  const windows = (sources || []).filter((s) => s.kind === 'window');
  const list = kind === 'window' ? windows : screens;
  const chosen = (sources || []).find((s) => s.id === sel);
  useEffect(() => {
    if (!sources) return;
    if (kind === 'window' && chosen?.kind !== 'window') setSel(windows[0]?.id || null);
    if (kind !== 'window' && chosen?.kind !== 'screen') setSel((screens.find((s) => s.display?.primary) || screens[0])?.id || null);
  }, [kind, sources]);

  const pickArea = async () => {
    const d = chosen?.display;
    const r = await call('recorder.pickArea', d?.id);
    if (r) setArea({ ...r, display: d?.id });
  };

  const start = async () => {
    if (!chosen) return;
    if (kind === 'area' && !area) { await pickArea(); return; }
    const prefs = { kind, mic, camera: cam, system, fps, countdown, autoZoom, hideCursor };
    try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch { /* ignore */ }
    setBusy(true);
    try {
      await call('recorder.start', {
        sourceId: chosen.id, area: kind === 'area' ? { x: area.x, y: area.y, w: area.w, h: area.h } : null,
        mic: mic || null, camera: cam || null, system: !!system && caps?.systemAudio, fps, countdown, autoZoom,
        cursor: hideCursor ? 'hide' : 'show', projectId: projectId || null,
      });
      onClose();
    } catch (e) { toast.error(e); setBusy(false); }
  };

  const importVideo = async () => {
    const files = await call('dialog.open', { title: '选择录像', filters: [{ name: '视频', extensions: ['mp4', 'mov', 'webm', 'mkv', 'm4v'] }] });
    if (!files?.length) return;
    setBusy(true);
    try {
      const r = await call('recorder.importVideo', files[0], { projectId: projectId || null });
      dispatchEvent(new CustomEvent('motif:open-project', { detail: { id: r.projectId } }));
      onClose();
    } catch (e) { toast.error(e); setBusy(false); }
  };

  const noClicks = caps && !caps.pointer?.clicks;
  return (
    <Modal title="录制屏幕" icon="monitor-dot" sub="录制后自动生成运镜、平滑光标与点击特效，可继续剪辑、调整背景和导出" onClose={onClose} width={760}
      footer={<>
        <button className="btn ghost" onClick={importVideo} disabled={busy}><Icon name="file-video-camera" size={14} />导入已有录像…</button>
        <div className="grow" />
        <span className="dim" style={{ fontSize: 11.5 }}>结束录制：{(caps?.shortcuts?.stop || 'Ctrl+Shift+F10').replace('CommandOrControl', 'Ctrl')}</span>
        <button className="btn" onClick={onClose}>取消</button>
        <button className="btn primary rec-go" onClick={start} disabled={busy || !chosen || caps?.busy}>
          {busy ? <Spinner size={13} /> : <span className="rec-dot" />}{kind === 'area' && !area ? '框选区域' : '开始录制'}
        </button>
      </>}>
      <div className="rec-dialog">
        <div className="row" style={{ gap: 10, marginBottom: 12 }}>
          <Segmented value={kind} onChange={setKind} options={[{ value: 'screen', label: '整个屏幕' }, { value: 'window', label: '窗口' }, { value: 'area', label: '区域' }]} />
          <div className="grow" />
          <button className="ibtn" title="刷新" onClick={refresh}><Icon name="refresh-cw" size={15} /></button>
        </div>
        {!sources ? <div className="empty" style={{ height: 180 }}><Spinner /></div>
          : !list.length ? <div className="empty" style={{ height: 180 }}>{kind === 'window' ? '没有可录制的窗口' : '没有找到屏幕'}{caps?.screenAccess && caps.screenAccess !== 'granted' ? '（请在系统设置中允许录屏）' : ''}</div>
          : (
            <div className={`rec-sources ${kind === 'window' ? 'windows' : ''}`}>
              {list.map((s) => (
                <button key={s.id} className={`rec-src ${sel === s.id ? 'on' : ''}`} onClick={() => { setSel(s.id); if (kind === 'area') setArea(null); }} onDoubleClick={start}>
                  <div className="shot">{s.thumb ? <img src={s.thumb} draggable={false} /> : <Icon name="monitor" size={22} />}
                    {kind === 'area' && sel === s.id && area ? <span className="area-chip">{area.w} × {area.h}</span> : null}
                  </div>
                  <div className="name">{s.icon ? <img src={s.icon} /> : <Icon name={s.kind === 'screen' ? 'monitor' : 'app-window'} size={13} />}<span className="ellipsis">{s.kind === 'screen' && screens.length === 1 ? '整个屏幕' : s.name}</span></div>
                </button>
              ))}
            </div>
          )}
        {kind === 'area' ? <div className="row" style={{ gap: 8, marginTop: 10 }}><button className="btn sm" onClick={pickArea} disabled={!chosen}><Icon name="scan" size={13} />{area ? '重新框选' : '在屏幕上框选区域'}</button>{area ? <span className="muted">已选 {area.w} × {area.h}（逻辑像素）</span> : null}</div> : null}

        <div className="rec-opts">
          <div className="col" style={{ gap: 8 }}>
            <Field label="麦克风"><Select value={mic} style={{ width: 230 }} onChange={setMic} options={[{ value: '', label: '不录制' }, { value: 'default', label: '默认麦克风' }, ...devices.mics.filter((d) => d.deviceId !== 'default').map((d) => ({ value: d.deviceId, label: d.label || '麦克风' }))]} /></Field>
            <Field label="系统声音" help={caps && !caps.systemAudio ? '当前系统不支持录制系统声音（仅 Windows）' : '电脑播放的声音'}><Switch value={!!system && !!caps?.systemAudio} disabled={!caps?.systemAudio} onChange={setSystem} /></Field>
            <Field label="摄像头"><Select value={cam} style={{ width: 230 }} onChange={setCam} options={[{ value: '', label: '不录制' }, ...devices.cams.map((d, i) => ({ value: d.deviceId || 'default', label: d.label || `摄像头 ${i + 1}` }))]} /></Field>
          </div>
          <div className="col" style={{ gap: 8 }}>
            <Field label="帧率"><Segmented value={fps} onChange={setFps} options={[{ value: 30, label: '30 fps' }, { value: 60, label: '60 fps' }]} /></Field>
            <Field label="倒计时"><Segmented value={countdown} onChange={setCountdown} options={[{ value: 0, label: '无' }, { value: 3, label: '3 秒' }, { value: 5, label: '5 秒' }]} /></Field>
            <Field label="自动运镜" help={noClicks ? '此系统无法记录点击，录完后可手动添加缩放' : '根据点击自动放大并跟随光标'}><Switch value={autoZoom} onChange={setAutoZoom} /></Field>
            <Field label="美化光标" help="尝试不录系统光标，改用平滑光标；系统不支持时保留原光标"><Switch value={hideCursor} onChange={setHideCursor} /></Field>
          </div>
          {cam ? <video ref={camRef} className="rec-cam" autoPlay muted playsInline /> : null}
        </div>
        {platform === 'darwin' ? <div className="muted" style={{ marginTop: 8 }}>首次录制时 macOS 会要求授予“屏幕录制”权限。</div> : null}
      </div>
    </Modal>
  );
}

/** Progress of a finished recording being processed; opens the project when ready. */
export function RecordingStatus({ onOpen }) {
  const [st, setSt] = useState(null);
  useEffect(() => on('recorder', (ev) => {
    if (ev.status === 'processing') setSt(ev);
    else if (ev.status === 'done') { setSt(null); toast.ok(`录屏已保存（${Math.round(ev.duration)} 秒）`); onOpen(ev.projectId); }
    else if (ev.status === 'error') { setSt(null); toast.error({ message: ev.error || '录制失败', hint: ev.hint }); }
    else if (ev.status === 'cancelled') setSt(null);
  }), [onOpen]);
  if (!st) return null;
  const label = { screen: '处理画面', camera: '处理摄像头', mic: '处理麦克风', system: '处理系统声音' }[st.step] || '正在处理录像';
  return (
    <div className="rec-status">
      <Spinner size={14} />
      <div className="grow"><div>{label}…</div><Progress value={st.progress || 0} /></div>
    </div>
  );
}
