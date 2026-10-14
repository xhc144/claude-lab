// Settings: library & tools, AI models (keys encrypted in the main process), and integrations that
// let external agents (Claude Code, Codex, DeepSeek/Qwen-based agents…) drive the same library.
import { useEffect, useState } from 'react';
import { Icon } from '../icons.jsx';
import { call } from '../api.js';
import { Modal, Field, TextInput, Switch, Select, Spinner, toast, CopyBox, confirmDialog } from '../ui.jsx';

export function Settings({ onClose, initialTab = 'general' }) {
  const [tab, setTab] = useState(initialTab);
  return (
    <Modal onClose={onClose} width="auto" bodyStyle={{ padding: 0 }}>
      <div className="settings">
        <nav>
          <div className="brand" style={{ padding: '6px 8px 12px' }}><span className="logo" />设置</div>
          <button className={tab === 'general' ? 'on' : ''} onClick={() => setTab('general')}><Icon name="sliders-horizontal" size={15} />常规</button>
          <button className={tab === 'ai' ? 'on' : ''} onClick={() => setTab('ai')}><Icon name="bot" size={15} />AI 模型</button>
          <button className={tab === 'integrations' ? 'on' : ''} onClick={() => setTab('integrations')}><Icon name="plug" size={15} />AI 集成</button>
          <button className={tab === 'shortcuts' ? 'on' : ''} onClick={() => setTab('shortcuts')}><Icon name="keyboard" size={15} />快捷键</button>
          <button className={tab === 'about' ? 'on' : ''} onClick={() => setTab('about')}><Icon name="info" size={15} />关于</button>
          <div className="spacer" />
          <button onClick={onClose}><Icon name="x" size={15} />关闭</button>
        </nav>
        <div className="pane">
          {tab === 'general' ? <General /> : tab === 'ai' ? <AIModels /> : tab === 'integrations' ? <Integrations /> : tab === 'shortcuts' ? <Shortcuts /> : <About />}
        </div>
      </div>
    </Modal>
  );
}

function General() {
  const [cfg, setCfg] = useState(null);
  const [info, setInfo] = useState(null);
  const load = () => { call('config.get').then(setCfg); call('app.info').then(setInfo); };
  useEffect(load, []);
  if (!cfg || !info) return <Spinner />;
  const set = async (patch) => { await call('config.set', patch); load(); };
  return (
    <>
      <h3>常规</h3>
      <p className="lead">素材库保存所有作品、模板、组件与主题。CLI、MCP 与外部 AI 读写的是同一个素材库。</p>
      <Field label="素材库位置">
        <div className="row" style={{ gap: 6 }}>
          <input className="input mono" readOnly value={info.library} />
          <button className="btn" onClick={async () => { const [d] = await call('dialog.open', { directory: true, title: '选择素材库文件夹' }); if (d) { await call('library.setRoot', d); load(); toast.ok('素材库已切换'); } }}>更改…</button>
          <button className="btn" onClick={() => call('shell.open', info.library)}><Icon name="folder-open" size={14} /></button>
        </div>
      </Field>
      <Field label="FFmpeg" help={info.ffmpeg ? `当前使用：${info.ffmpeg}` : '未找到 FFmpeg：视频导出需要它。安装版已内置；也可指定本机的 ffmpeg 可执行文件。'}>
        <div className="row" style={{ gap: 6 }}>
          <input className="input mono" readOnly value={cfg.ffmpegPath || (info.ffmpeg ? '自动检测' : '')} placeholder="自动检测" />
          <button className="btn" onClick={async () => { const [f] = await call('dialog.open', { title: '选择 ffmpeg 可执行文件' }); if (f) set({ ffmpegPath: f }); }}>指定…</button>
          {cfg.ffmpegPath ? <button className="btn" onClick={() => set({ ffmpegPath: null })}>重置</button> : null}
        </div>
      </Field>
      <Field label="默认作者名" help="写入历史记录，便于区分人与 AI 的修改"><TextInput value={cfg.authorName} placeholder="你" onCommit={(v) => set({ authorName: v || null })} /></Field>
      <div className="divider" style={{ margin: '14px 0' }} />
      <div className="kv">
        <div>版本</div><div>{info.version}（Electron {info.electron}）</div>
        <div>配置目录</div><div className="mono" style={{ fontSize: 11.5 }}>{info.userData}</div>
        <div>处理器</div><div>{info.cpus} 线程（导出时并行渲染）</div>
      </div>
    </>
  );
}

function AIModels() {
  const [st, setSt] = useState(null);
  const [edit, setEdit] = useState(null);
  const [testing, setTesting] = useState(null);
  const load = () => call('ai.providers').then(setSt).catch((e) => toast.error(e));
  useEffect(() => { load(); }, []);
  if (!st) return <Spinner />;
  const test = async (id) => {
    setTesting(id);
    try { const r = await call('ai.test', id); toast.ok(`连接成功（${r.model}，${r.ms} ms）：${r.reply || 'OK'}`); }
    catch (e) { toast.error(e); }
    finally { setTesting(null); }
  };
  return (
    <>
      <h3>AI 模型</h3>
      <p className="lead">内置 AI 助手使用你自己的模型：云端服务或本地运行均可。API Key 使用系统钥匙串加密保存在本机{st.encrypted ? '' : '（当前系统不支持加密存储，将以编码形式保存）'}，不会上传到任何地方。</p>
      <div className="col" style={{ gap: 8 }}>
        {st.providers.map((p) => (
          <div key={p.id} className={`provider ${st.active === p.id ? 'active' : ''}`}>
            <span className="ai-orb" style={{ width: 18, height: 18, opacity: st.active === p.id ? 1 : 0.35 }} />
            <div className="grow" style={{ minWidth: 0 }}>
              <div style={{ color: 'var(--fg0)', fontWeight: 600 }}>{p.name} {st.active === p.id ? <span className="badge acc">默认</span> : null}</div>
              <div className="dim mono ellipsis" style={{ fontSize: 11.5 }}>{p.model} · {p.baseUrl || '默认地址'} {p.hasKey ? `· ${p.keyHint}` : '· 无 Key'}</div>
            </div>
            {st.active !== p.id ? <button className="btn sm" onClick={async () => setSt(await call('ai.setActive', p.id))}>设为默认</button> : null}
            <button className="btn sm" onClick={() => test(p.id)} disabled={testing === p.id}>{testing === p.id ? <Spinner size={12} /> : <Icon name="plug" size={12} />}测试</button>
            <button className="ibtn sm" onClick={() => setEdit({ ...p, key: undefined })}><Icon name="pen-line" size={13} /></button>
            <button className="ibtn sm" onClick={async () => { if (await confirmDialog({ title: `删除「${p.name}」？`, ok: '删除', danger: true })) setSt(await call('ai.deleteProvider', p.id)); }}><Icon name="trash" size={13} /></button>
          </div>
        ))}
        {!st.providers.length ? <div className="empty" style={{ padding: 18 }}>还没有配置模型</div> : null}
      </div>
      <div className="dim" style={{ margin: '18px 0 8px', fontSize: 11.5 }}>添加模型</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 6 }}>
        {st.presets.map((p) => (
          <button key={p.preset} className="chip" style={{ height: 38, justifyContent: 'flex-start', borderRadius: 8 }} onClick={() => setEdit({ ...p, key: '' })}>
            <Icon name={p.noKey ? 'cpu' : 'cloud'} size={14} />{p.name}
          </button>
        ))}
      </div>
      {edit ? <ProviderEditor p={edit} presets={st.presets} onClose={() => setEdit(null)} onSaved={(r) => { setSt(r); setEdit(null); }} /> : null}
    </>
  );
}

function ProviderEditor({ p, presets, onClose, onSaved }) {
  const [v, setV] = useState({ ...p });
  const preset = presets.find((x) => x.preset === v.preset);
  const set = (patch) => setV((o) => ({ ...o, ...patch }));
  const save = async () => {
    if (!v.model?.trim()) { toast('请填写模型名称'); return; }
    if (v.kind === 'openai' && !v.baseUrl?.trim()) { toast('请填写接口地址'); return; }
    try { onSaved(await call('ai.saveProvider', { id: v.id, preset: v.preset, kind: v.kind, name: v.name, baseUrl: v.baseUrl, model: v.model.trim(), vision: v.vision, key: v.key, maxTokens: v.maxTokens, makeActive: !v.id })); }
    catch (e) { toast.error(e); }
  };
  return (
    <Modal title={v.id ? `编辑「${v.name}」` : `添加 ${v.name}`} icon="bot" onClose={onClose} width={520}
      footer={<><button className="btn" onClick={onClose}>取消</button><button className="btn primary" onClick={save}>保存</button></>}>
      <Field label="名称"><TextInput value={v.name} onChange={(x) => set({ name: x })} /></Field>
      <Field label="接口类型"><Select value={v.kind} options={[{ value: 'openai', label: 'OpenAI 兼容（chat/completions）' }, { value: 'anthropic', label: 'Anthropic Messages' }]} onChange={(x) => set({ kind: x })} /></Field>
      <Field label="接口地址" help={v.kind === 'anthropic' ? '默认 https://api.anthropic.com' : '以 /v1 等版本路径结尾，不含 /chat/completions'}><TextInput mono value={v.baseUrl} placeholder={preset?.baseUrl || 'https://…/v1'} onChange={(x) => set({ baseUrl: x })} /></Field>
      <Field label="模型" help="填写服务商提供的模型 ID；需支持工具调用（function calling）"><TextInput mono value={v.model} onChange={(x) => set({ model: x })} /></Field>
      <Field label="API Key" help={v.id && v.hasKey ? '留空则保持原有 Key' : preset?.noKey ? '本地服务通常不需要' : undefined}>
        <input className="input mono" type="password" value={v.key ?? ''} placeholder={v.id && v.hasKey ? '••••••（已保存）' : 'sk-…'} onChange={(e) => set({ key: e.target.value })} />
        {preset?.keyUrl ? <div className="help"><a href={preset.keyUrl} onClick={(e) => { e.preventDefault(); call('shell.external', preset.keyUrl); }}>获取 API Key ↗</a></div> : null}
      </Field>
      <Field label="识图能力" help="开启后，AI 能看到它渲染的预览画面来自我检查（需模型支持图片输入）"><div style={{ paddingTop: 5 }}><Switch value={!!v.vision} onChange={(x) => set({ vision: x })} /></div></Field>
      <Field label="最大输出"><TextInput mono value={String(v.maxTokens || 8192)} onChange={(x) => set({ maxTokens: Number(x) || 8192 })} /></Field>
    </Modal>
  );
}

function Integrations() {
  const [info, setInfo] = useState(null);
  useEffect(() => { call('integrations.info').then(setInfo).catch((e) => toast.error(e)); }, []);
  if (!info) return <Spinner />;
  const install = async (id) => {
    try { const r = await call('integrations.installSkill', id); toast.ok(`Skill 已安装到 ${r.installed}`); }
    catch (e) { toast.error(e); }
  };
  return (
    <>
      <h3>AI 集成</h3>
      <p className="lead">Claude、Codex、DeepSeek、Qwen 等任何能调用命令行或 MCP 的 AI 工具，都可以直接创建和编辑这里的作品。AI 做的修改在编辑器里实时出现、可继续手动修改；你的修改 AI 也能读到。</p>
      <h4 style={{ margin: '4px 0 8px', color: 'var(--fg0)' }}>1 · 安装 Skill</h4>
      <p className="dim" style={{ marginTop: 0 }}>Skill 包含完整工作流说明（素材分析 → 创建 → 设计 → 动画 → 检查 → 导出）、组件参考与示例。</p>
      <div className="col" style={{ gap: 6, marginBottom: 18 }}>
        {info.skillTargets.map((t) => (
          <div key={t.id} className="provider"><Icon name="folder" size={15} /><span className="grow">{t.label}</span><button className="btn sm" disabled={!info.skill} onClick={() => install(t.id)}>安装 / 更新</button></div>
        ))}
        {info.skill ? <div className="row dim" style={{ fontSize: 11.5 }}>Skill 源：<span className="mono">{info.skill}</span><button className="btn sm ghost" onClick={() => call('shell.open', info.skill)}>打开</button></div> : <div className="dim">未找到随附的 Skill 包</div>}
      </div>
      <h4 style={{ margin: '4px 0 8px', color: 'var(--fg0)' }}>2 · 命令行（CLI）</h4>
      <CopyBox text={`${info.cli} --help`} />
      <div style={{ height: 18 }} />
      <h4 style={{ margin: '4px 0 8px', color: 'var(--fg0)' }}>3 · MCP 服务器</h4>
      <div className="dim" style={{ marginBottom: 6 }}>Claude Code：</div>
      <CopyBox text={info.claudeCode} />
      <div className="dim" style={{ margin: '12px 0 6px' }}>Codex（~/.codex/config.toml）：</div>
      <CopyBox text={info.codex} />
      <div className="dim" style={{ margin: '12px 0 6px' }}>Claude Desktop、Cursor、Cherry Studio 等（mcpServers JSON）：</div>
      <CopyBox text={JSON.stringify(info.mcpJson, null, 2)} />
    </>
  );
}

export const SHORTCUTS = [
  ['空格', '播放 / 暂停'], ['Ctrl+Z / Ctrl+Y', '撤销 / 重做'], ['Ctrl+K 或 /', '添加元素'], ['Ctrl+D', '复制元素或场景'], ['Delete', '删除选中元素'],
  ['Enter / 双击', '直接编辑文字'], ['方向键', '微调位置（Shift ×10）'], ['← / →（未选元素）', '上一个 / 下一个场景'], ['Alt + 拖动', '拖动时不吸附'], ['Shift + 拖动', '锁定方向 / 等比缩放'],
  ['Home / End', '跳到开头 / 结尾'], ['F5', '演示'], ['Ctrl+E', '导出'], ['Ctrl+N / Ctrl+I', '新建 / 导入素材'], ['Esc', '取消选择 / 关闭'],
];
function Shortcuts() {
  return (
    <>
      <h3>快捷键</h3>
      <div className="kv" style={{ gridTemplateColumns: '200px 1fr', marginTop: 14 }}>
        {SHORTCUTS.map(([k, v]) => [<div key={k}><kbd>{k}</kbd></div>, <div key={k + v}>{v}</div>])}
      </div>
      <h4 style={{ margin: '22px 0 8px', color: 'var(--fg0)' }}>演示模式</h4>
      <div className="kv" style={{ gridTemplateColumns: '200px 1fr' }}>
        <div><kbd>→ / 空格 / 单击</kbd></div><div>下一步（先完成当前动画）</div>
        <div><kbd>← / 右键</kbd></div><div>上一页</div>
        <div><kbd>A</kbd></div><div>逐页 / 连续播放</div>
        <div><kbd>N</kbd></div><div>显示演讲备注</div>
      </div>
    </>
  );
}

function About() {
  const [info, setInfo] = useState(null);
  useEffect(() => { call('app.info').then(setInfo); }, []);
  return (
    <>
      <div className="row" style={{ gap: 14, marginBottom: 16 }}>
        <span className="brand" style={{ padding: 0 }}><span className="logo" style={{ width: 48, height: 48, borderRadius: 12 }} /></span>
        <div><h3 style={{ fontSize: 20 }}>Motif 律影</h3><div className="dim">动态视觉创作软件 · {info?.version}</div></div>
      </div>
      <p style={{ lineHeight: 1.75, color: 'var(--fg1)' }}>
        Motif 把专业动态设计的经验沉淀为软件本身：10 套设计系统（配色、字体、版式规则、动画语言、转场与镜头）、40 多种可组合的内容组件，以及一个确定性的渲染引擎——编辑器里看到的、AI 预览到的与最终导出的完全一致。
      </p>
      <p style={{ lineHeight: 1.75, color: 'var(--fg1)' }}>
        人与 AI 共用同一个项目系统：作品、模板、组件、主题与历史都保存在素材库中。AI 通过 Skill / CLI / MCP 提供内容与数据，Motif 完成复杂的设计与动画；人在编辑器里随时接手。
      </p>
      <div className="dim" style={{ marginTop: 16, fontSize: 11.5 }}>使用的开源项目：Electron、React、three.js、MathJax、pdf.js、Lucide、fflate、FFmpeg，以及 Inter、Noto Sans/Serif SC、Fraunces、Space Grotesk、Archivo、Outfit、JetBrains Mono、Instrument Serif、马善政楷书 等字体。</div>
    </>
  );
}
