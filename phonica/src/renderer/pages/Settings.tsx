import { useEffect, useRef, useState } from 'react';
import type { AiProviderConfig, Settings as S } from '../../shared/types.ts';
import { api } from '../lib/api.ts';
import { Recorder } from '../lib/recorder.ts';
import { useApp } from '../lib/store.tsx';
import { fmtBytes, uid } from '../lib/format.ts';
import { Seg, Switch, Modal } from '../components/ui.tsx';
import { IconFolder, IconPlus, IconTrash, IconEdit, IconCheck, IconMic, IconStop } from '../components/icons.tsx';

const KINDS: Record<AiProviderConfig['kind'], string> = { openai: 'OpenAI', anthropic: 'Anthropic Claude', deepseek: 'DeepSeek', gemini: 'Google Gemini（OpenAI 兼容）', 'custom-openai': '其他 OpenAI 兼容服务' };
const KIND_DEFAULTS: Record<AiProviderConfig['kind'], Partial<AiProviderConfig>> = {
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-audio-preview', audioInput: true },
  anthropic: { baseUrl: 'https://api.anthropic.com', model: 'claude-opus-5-5', audioInput: false, maxTokens: 16000 },
  deepseek: { baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat', audioInput: false },
  gemini: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.5-flash', audioInput: true },
  'custom-openai': { baseUrl: 'http://localhost:11434/v1', model: '', audioInput: false },
};

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="card pad">
      <div className="card-title" style={{ marginBottom: desc ? 2 : 12 }}>{title}</div>
      {desc && <div className="small muted" style={{ marginBottom: 14 }}>{desc}</div>}
      <div className="col" style={{ gap: 14 }}>{children}</div>
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="row" style={{ alignItems: 'flex-start' }}>
      <div style={{ width: 200, flex: 'none', paddingTop: 6 }}>
        <div style={{ fontWeight: 500 }}>{label}</div>
        {hint && <div className="tiny muted">{hint}</div>}
      </div>
      <div className="grow">{children}</div>
    </div>
  );
}

export function Settings() {
  const { settings, updateSettings, engine, toast } = useApp();
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [testing, setTesting] = useState(false);
  const [level, setLevel] = useState(0);
  const [editing, setEditing] = useState<AiProviderConfig | null>(null);
  const [info, setInfo] = useState<{ version: string; dataDir: string } | null>(null);
  const rec = useRef<Recorder | null>(null);

  useEffect(() => {
    Recorder.devices().then(setDevices);
    api.appInfo().then(setInfo).catch(() => undefined);
    return () => rec.current?.cancel();
  }, []);

  if (!settings) return null;
  const set = (p: Partial<S>) => void updateSettings(p);

  const testMic = async () => {
    if (testing) {
      rec.current?.cancel();
      rec.current = null;
      setTesting(false);
      setLevel(0);
      return;
    }
    const r = new Recorder({ deviceId: settings.inputDeviceId, sampleRate: settings.recordSampleRate, onLevel: (rms) => setLevel(rms) });
    try {
      await r.start();
      rec.current = r;
      setTesting(true);
      setDevices(await Recorder.devices());
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  const saveProvider = (p: AiProviderConfig) => {
    const list = settings.aiProviders.some((x) => x.id === p.id) ? settings.aiProviders.map((x) => (x.id === p.id ? p : x)) : [...settings.aiProviders, p];
    set({ aiProviders: list, aiActiveProvider: settings.aiActiveProvider || p.id });
    setEditing(null);
  };

  const m = engine.info?.scoring?.metrics;
  const db = Math.max(-60, 20 * Math.log10(level + 1e-6));
  const perMin = (settings.exportBitrate * 1000 * 60) / 8;

  return (
    <div className="page">
      <div className="page-head"><div><h1>设置</h1><p>所有数据默认只保存在本机</p></div></div>
      <div className="col" style={{ gap: 16, maxWidth: 980 }}>
        <Section title="发音与口音">
          <Row label="默认目标口音" hint="影响音标、标准发音和评测时的首选读法">
            <Seg value={settings.accent} onChange={(v) => set({ accent: v })} options={[{ value: 'us', label: '美式英语' }, { value: 'uk', label: '英式英语 (RP)' }]} />
          </Row>
          <Row label="美音发音人">
            <select className="select" style={{ width: 240 }} value={settings.voiceUS} onChange={(e) => set({ voiceUS: e.target.value })}>
              {[['af_heart', 'Heart（女声）'], ['af_bella', 'Bella（女声）'], ['am_michael', 'Michael（男声）'], ['am_fenrir', 'Fenrir（男声）']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Row>
          <Row label="英音发音人">
            <select className="select" style={{ width: 240 }} value={settings.voiceUK} onChange={(e) => set({ voiceUK: e.target.value })}>
              {[['bf_emma', 'Emma（女声）'], ['bf_isabella', 'Isabella（女声）'], ['bm_george', 'George（男声）'], ['bm_fable', 'Fable（男声）']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Row>
          <Row label="标准发音默认语速">
            <div className="row"><input type="range" min={0.5} max={1.5} step={0.05} value={settings.ttsSpeed} onChange={(e) => set({ ttsSpeed: Number(e.target.value) })} style={{ width: 220 }} /><span>{settings.ttsSpeed.toFixed(2)}×</span></div>
          </Row>
          <Row label="界面主题">
            <Seg value={settings.theme} onChange={(v) => set({ theme: v })} options={[{ value: 'system', label: '跟随系统' }, { value: 'light', label: '浅色' }, { value: 'dark', label: '深色' }]} />
          </Row>
        </Section>

        <Section title="录音" desc="评测使用无损原始录音（WAV），录音时关闭了回声消除、降噪和自动增益，以免改变发音的声学特征。">
          <Row label="麦克风">
            <div className="row">
              <select className="select" style={{ width: 340 }} value={settings.inputDeviceId} onChange={(e) => set({ inputDeviceId: e.target.value })}>
                <option value="default">系统默认设备</option>
                {devices.filter((d) => d.deviceId !== 'default').map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label || `麦克风 ${d.deviceId.slice(0, 6)}`}</option>)}
              </select>
              <button className="btn" onClick={testMic}>{testing ? <IconStop /> : <IconMic />}{testing ? '停止测试' : '测试'}</button>
            </div>
            {testing && (
              <div className="row" style={{ marginTop: 10 }}>
                <div className="progress grow" style={{ height: 10 }}><i style={{ width: `${Math.max(0, (db + 60) / 60) * 100}%`, background: db > -3 ? 'var(--poor)' : db > -30 ? 'var(--good)' : 'var(--fair)' }} /></div>
                <span className="small" style={{ width: 120 }}>{db.toFixed(0)} dBFS {db > -3 ? '过大' : db < -40 ? '太小' : '合适'}</span>
              </div>
            )}
          </Row>
          <Row label="原始录音采样率" hint="保存在本地，用于评测和回放">
            <Seg value={settings.recordSampleRate} onChange={(v) => set({ recordSampleRate: v })} options={[{ value: 48000, label: '48 kHz' }, { value: 44100, label: '44.1 kHz' }, { value: 16000, label: '16 kHz（省空间）' }]} />
          </Row>
          <Row label="静音自动停止" hint="说完后持续静音多久自动结束录音">
            <Seg value={settings.autoStopSilenceSec} onChange={(v) => set({ autoStopSilenceSec: v })} options={[{ value: 0, label: '关闭' }, { value: 1.5, label: '1.5 秒' }, { value: 2.5, label: '2.5 秒' }, { value: 4, label: '4 秒' }]} />
          </Row>
        </Section>

        <Section title="导出" desc="导出音频单独压缩，不影响本地评测精度。">
          <Row label="默认音频质量">
            <Seg value={`${settings.exportBitrate}/${settings.exportSampleRate}`} onChange={(v) => { const [b, s] = v.split('/').map(Number); set({ exportBitrate: b as S['exportBitrate'], exportSampleRate: s as S['exportSampleRate'] }); }} options={[
              { value: '32/16000', label: '32 kbps · 16 kHz' },
              { value: '64/24000', label: '64 kbps · 24 kHz（推荐）' },
              { value: '96/44100', label: '96 kbps · 44.1 kHz' },
              { value: '192/44100', label: '192 kbps · 44.1 kHz' },
            ]} />
            <div className="tiny muted" style={{ marginTop: 6 }}>约 {fmtBytes(perMin)} / 分钟，单声道 MP3。AI 分析发送音频时也使用此设置。</div>
          </Row>
          <Row label="ZIP 包附带标准发音">
            <Switch on={settings.exportIncludeReference} onChange={(v) => set({ exportIncludeReference: v })} />
          </Row>
        </Section>

        <Section title="AI 服务" desc="可选功能。配置后可在评测结果中进行 AI 深度分析；不配置也不影响录音、评测和导出。API 密钥使用 Windows 凭据保护（DPAPI）加密保存在本机。">
          <Row label="分析语言">
            <Seg value={settings.aiLanguage} onChange={(v) => set({ aiLanguage: v })} options={[{ value: 'zh', label: '中文' }, { value: 'en', label: 'English' }]} />
          </Row>
          <table className="tbl">
            <thead><tr><th>默认</th><th>名称</th><th>类型</th><th>模型</th><th>音频输入</th><th>密钥</th><th></th></tr></thead>
            <tbody>
              {settings.aiProviders.map((p) => (
                <tr key={p.id}>
                  <td><input type="radio" checked={settings.aiActiveProvider === p.id} onChange={() => set({ aiActiveProvider: p.id })} /></td>
                  <td style={{ fontWeight: 600 }}>{p.name}</td>
                  <td className="small muted">{KINDS[p.kind]}</td>
                  <td className="mono">{p.model}</td>
                  <td>{p.kind === 'anthropic' || p.kind === 'deepseek' ? <span className="chip">不支持</span> : p.audioInput ? <span className="chip good">发送录音</span> : <span className="chip">仅数据</span>}</td>
                  <td>{p.apiKey ? <span className="chip good"><IconCheck style={{ width: 12, height: 12 }} />已配置</span> : <span className="chip">未配置</span>}</td>
                  <td>
                    <div className="row" style={{ gap: 2 }}>
                      <button className="btn sm ghost icon" onClick={() => setEditing({ ...p })}><IconEdit /></button>
                      <button className="btn sm ghost icon" onClick={() => set({ aiProviders: settings.aiProviders.filter((x) => x.id !== p.id) })}><IconTrash /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div><button className="btn" onClick={() => setEditing({ id: uid(), name: '自定义服务', kind: 'custom-openai', baseUrl: 'http://localhost:11434/v1', apiKey: '', model: '', audioInput: false, temperature: 0.4, maxTokens: 4000 })}><IconPlus />添加服务</button></div>
        </Section>

        <Section title="数据">
          <Row label="数据文件夹" hint="录音、评测结果、AI 分析与素材">
            <div className="row">
              <input className="input mono" readOnly value={settings.dataDir} />
              <button className="btn" onClick={() => api.openDataDir()}><IconFolder />打开</button>
              <button className="btn" onClick={async () => { const d = await api.chooseDataDir(); if (d) { set({ dataDir: d }); toast('数据文件夹已切换，新录音将保存到新位置', 'success'); } }}>更改</button>
            </div>
          </Row>
        </Section>

        <Section title="关于评测引擎">
          <div className="small" style={{ lineHeight: 1.8 }}>
            <div>声准 Phonica {info?.version} · 引擎状态：{engine.ready ? '就绪' : engine.error ? `错误：${engine.error}` : '加载中'}{engine.info?.verifier ? ' · 双模型校验已启用' : ''}{engine.info?.tts ? ' · 离线语音合成已启用' : ''}</div>
            <div>• 对齐与音素后验：charsiu/en_w2v2_fc_10ms（wav2vec2，10 毫秒帧级音素分类，MIT）</div>
            <div>• 音素识别与替换/漏读校验：facebook/wav2vec2-lv-60-espeak-cv-ft（CTC 音素识别，Apache-2.0）</div>
            <div>• 发音词典：CMUdict + eSpeak-NG（英音 RP）+ g2p 神经网络（词典外单词）</div>
            <div>• 标准发音：Kokoro-82M 离线神经语音合成（Apache-2.0）</div>
            <div>• 评分校准：在 speechocean762（中国学习者英语朗读，专家标注，CC BY 4.0）训练集上训练，并在独立测试集验证。</div>
            {m && <div>• 与人工评分的皮尔逊相关系数（测试集）：音素 {m.phone_pcc}，单词 {m.word_pcc}，句子准确度 {m.sentence_accuracy_pcc}，流利度 {m.sentence_fluency_pcc}，韵律 {m.sentence_prosody_pcc}，总分 {m.sentence_total_pcc}</div>}
            <div className="muted">所有计算在本机完成，不需要联网。</div>
          </div>
        </Section>
      </div>
      {editing && <ProviderModal p={editing} onClose={() => setEditing(null)} onSave={saveProvider} />}
    </div>
  );
}

function ProviderModal({ p, onClose, onSave }: { p: AiProviderConfig; onClose: () => void; onSave: (p: AiProviderConfig) => void }) {
  const [d, setD] = useState(p);
  const [test, setTest] = useState<{ ok: boolean; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const noAudio = d.kind === 'anthropic' || d.kind === 'deepseek';
  return (
    <Modal title="AI 服务配置" onClose={onClose} footer={<><button className="btn" onClick={onClose}>取消</button><button className="btn primary" onClick={() => onSave(d)}>保存</button></>}>
      <div className="col" style={{ gap: 12 }}>
        <div className="grid2">
          <div className="field"><label>名称</label><input className="input" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} /></div>
          <div className="field"><label>接口类型</label>
            <select className="select" value={d.kind} onChange={(e) => { const k = e.target.value as AiProviderConfig['kind']; setD({ ...d, kind: k, ...KIND_DEFAULTS[k] }); }}>
              {Object.entries(KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
        </div>
        <div className="field"><label>API 地址</label><input className="input mono" value={d.baseUrl} onChange={(e) => setD({ ...d, baseUrl: e.target.value })} /><div className="hint">{d.kind === 'anthropic' ? '官方地址为 https://api.anthropic.com；也可填写兼容 Anthropic Messages API 的网关。' : '填写到 /v1 一级（会请求 …/chat/completions），支持代理、中转与本地模型服务。'}</div></div>
        <div className="field"><label>API 密钥</label><input className="input mono" type="password" value={d.apiKey} onChange={(e) => setD({ ...d, apiKey: e.target.value })} placeholder="sk-…" /></div>
        <div className="grid2">
          <div className="field"><label>模型</label><input className="input mono" value={d.model} onChange={(e) => setD({ ...d, model: e.target.value })} /></div>
          <div className="field"><label>最大输出长度（tokens）</label><input className="input" type="number" value={d.maxTokens} onChange={(e) => setD({ ...d, maxTokens: Number(e.target.value) || 4000 })} /></div>
        </div>
        <div className="row">
          <Switch on={d.audioInput && !noAudio} disabled={noAudio} onChange={(v) => setD({ ...d, audioInput: v })} />
          <div>
            <div>该模型支持音频输入</div>
            <div className="tiny muted">{noAudio ? '该服务不接收音频，将只发送传统评测数据，结果会标注“基于评测数据”。' : '开启后会把压缩后的录音（MP3）与评测数据一起发送，如 gpt-4o-audio-preview、Gemini 等；不支持音频的模型请关闭。'}</div>
          </div>
        </div>
        <div className="row">
          <button className="btn" disabled={busy} onClick={async () => { setBusy(true); setTest(null); try { setTest({ ok: true, msg: await api.aiTest(d.id, d) }); } catch (e) { setTest({ ok: false, msg: (e as Error).message }); } finally { setBusy(false); } }}>{busy ? '测试中…' : '测试连接'}</button>
          {test && <span className={`small ${test.ok ? 'score-good' : 'score-poor'}`}>{test.ok ? '连接成功：' : '失败：'}{test.msg}</span>}
        </div>
      </div>
    </Modal>
  );
}
