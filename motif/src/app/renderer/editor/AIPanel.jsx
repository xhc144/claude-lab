// In-app AI assistant. The model edits the open project through the same tools external agents
// use (CLI / MCP), so its changes land in history, show up live, and stay hand-editable.
import { useEffect, useRef, useState } from 'react';
import { editor, useEditor } from './store.js';
import { Icon } from '../icons.jsx';
import { call, on } from '../api.js';
import { Select, Spinner, toast } from '../ui.jsx';

const TOOL_LABEL = {
  motif_get_project: '读取作品', motif_apply_ops: '修改作品', motif_write_document: '写入整套场景', motif_lint: '设计检查', motif_preview: '渲染预览',
  motif_render_still: '渲染画面', motif_catalog: '查阅组件文档', motif_list_themes: '查看主题', motif_list_templates: '查看模板', motif_import_asset: '导入资源',
  motif_list_components: '查看组件库', motif_insert_component: '插入组件', motif_save_component: '保存组件', motif_history: '查看历史', motif_restore: '恢复版本',
  motif_export: '导出', motif_analyze_files: '分析素材', motif_auto_create: '自动创建', motif_create_project: '新建项目', motif_list_projects: '列出项目',
};

const sessions = new Map(); // project id → messages (kept while the app runs)

export function AIPanel() {
  const project = useEditor((s) => s.project);
  const sel = useEditor((s) => s.sel);
  const [prov, setProv] = useState(null);
  const [msgs, setMsgs] = useState(() => sessions.get(project?.id) || []);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(null); // chatId
  const logRef = useRef(null);
  const taRef = useRef(null);

  useEffect(() => { call('ai.providers').then(setProv).catch(() => setProv({ providers: [] })); }, []);
  useEffect(() => { if (project) sessions.set(project.id, msgs); }, [msgs, project]);
  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' }); }, [msgs]);
  useEffect(() => {
    const f = (e) => { if (e.detail?.prompt) { setInput(e.detail.prompt); setTimeout(() => taRef.current?.focus(), 50); } };
    addEventListener('motif:open-ai', f);
    const pending = window.__motifAiPrompt;
    if (pending) { window.__motifAiPrompt = null; setInput(pending.prompt || ''); if (pending.send) setTimeout(() => send(pending.prompt), 300); }
    return () => removeEventListener('motif:open-ai', f);
  }, []);

  useEffect(() => on('ai', (ev) => {
    setMsgs((list) => {
      const n = list.slice();
      let last = n[n.length - 1];
      if (!last || last.role !== 'assistant' || last.chatId !== ev.chatId) return list;
      last = { ...last, steps: [...last.steps] };
      if (ev.type === 'text') last.text = (last.text ? last.text + '\n\n' : '') + ev.text;
      else if (ev.type === 'tool') last.steps.push({ id: ev.id, name: ev.name, args: ev.args, running: true });
      else if (ev.type === 'tool_result') last.steps = last.steps.map((s) => (s.id === ev.id ? { ...s, running: false, ok: ev.ok, summary: ev.summary, image: ev.image } : s));
      else if (ev.type === 'error') { last.error = ev.message; last.hint = ev.hint; last.done = true; }
      else if (ev.type === 'cancelled') { last.cancelled = true; last.done = true; }
      else if (ev.type === 'done') last.done = true;
      n[n.length - 1] = last;
      return n;
    });
    if (['done', 'error', 'cancelled'].includes(ev.type)) { setBusy(null); editor.aiActive = false; }
  }), []);

  const send = async (text) => {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    await editor.flushNow();
    const history = msgs.filter((m) => !m.error).map((m) => ({ role: m.role, content: m.role === 'user' ? m.text : m.text || '（已执行修改）' })).slice(-16);
    const chatId = 'chat_' + Math.random().toString(36).slice(2, 9);
    setMsgs((l) => [...l, { role: 'user', text: q }, { role: 'assistant', chatId, text: '', steps: [] }]);
    setInput('');
    setBusy(chatId);
    editor.aiActive = true;
    try {
      await call('ai.chat', { chatId, provider: prov?.active, project: editor.project.id, selection: sel, messages: [...history, { role: 'user', content: q }] });
    } catch (e) {
      setBusy(null); editor.aiActive = false;
      setMsgs((l) => { const n = l.slice(); n[n.length - 1] = { ...n[n.length - 1], error: e.message, hint: e.hint, done: true }; return n; });
    }
  };

  const stop = () => { if (busy) call('ai.cancel', busy); };
  const openSettings = () => dispatchEvent(new CustomEvent('motif:settings', { detail: { tab: 'ai' } }));

  if (prov && !prov.providers.length) {
    return (
      <div className="ai-panel">
        <div className="empty" style={{ marginTop: 40 }}>
          <div className="ai-orb" style={{ width: 44, height: 44 }} />
          <div style={{ color: 'var(--fg0)', fontSize: 14, fontWeight: 600 }}>连接一个 AI 模型</div>
          <div style={{ maxWidth: 260 }}>支持 Claude、OpenAI、DeepSeek、通义千问、Kimi、智谱，以及 Ollama / LM Studio 本地模型。密钥加密保存在本机。</div>
          <button className="btn ai" onClick={openSettings}><Icon name="plug" size={14} />添加模型</button>
          <div className="dim" style={{ fontSize: 11.5, maxWidth: 270, marginTop: 6 }}>也可以在 Claude Code、Codex 等外部 AI 工具中通过 Skill / CLI / MCP 编辑同一个作品：菜单 帮助 → AI 集成。</div>
        </div>
      </div>
    );
  }

  const selBlock = sel.block;
  const suggestions = selBlock
    ? ['把选中元素的文字改得更简洁有力', '把选中内容换成更合适的可视化形式', '为选中元素设计更有冲击力的动画']
    : ['检查设计问题并修复', '让整部作品节奏更紧凑', '为每个场景写演讲备注', '在第 2 页后加一页关键数字', '改成适合竖屏短视频的版本'];

  return (
    <div className="ai-panel">
      <div className="row" style={{ padding: '8px 10px', borderBottom: '1px solid var(--line)' }}>
        <span className="dim" style={{ fontSize: 11.5, whiteSpace: 'nowrap' }}>模型</span>
        <Select value={prov?.active || ''} style={{ height: 26 }} options={(prov?.providers || []).map((p) => ({ value: p.id, label: `${p.name} · ${p.model}` }))} onChange={async (v) => setProv(await call('ai.setActive', v))} />
        <button className="ibtn sm" title="模型设置" onClick={openSettings}><Icon name="settings" size={14} /></button>
        <button className="ibtn sm" title="清空对话" disabled={!msgs.length || !!busy} onClick={() => setMsgs([])}><Icon name="trash" size={14} /></button>
      </div>
      <div className="ai-log" ref={logRef}>
        {!msgs.length ? (
          <div className="empty" style={{ marginTop: 20 }}>
            <div className="ai-orb" style={{ width: 36, height: 36 }} />
            <div style={{ color: 'var(--fg0)', fontWeight: 600 }}>告诉我你想怎么改</div>
            <div style={{ maxWidth: 270 }}>我会直接修改这部作品——用的是 Motif 的设计系统，所以你给内容和方向，版式、动画与转场由软件完成。每一步都记录在历史中，可撤销。</div>
          </div>
        ) : null}
        {msgs.map((m, i) => (m.role === 'user'
          ? <div key={i} className="ai-msg user">{m.text}</div>
          : (
            <div key={i} className="ai-msg assistant">
              <div className="who"><span className={`ai-orb ${!m.done ? 'busy' : ''}`} style={{ width: 12, height: 12 }} />Motif AI</div>
              {m.steps?.length ? (
                <div className="ai-steps" style={{ marginBottom: m.text ? 8 : 0 }}>
                  {m.steps.map((s) => (
                    <div key={s.id} className={`ai-step ${s.ok === false ? 'err' : ''}`} style={s.image ? { flexDirection: 'column', alignItems: 'stretch' } : null}>
                      <div className="row" style={{ gap: 6 }}>
                        {s.running ? <Spinner size={12} /> : <Icon name={s.ok === false ? 'circle-x' : 'check'} size={13} />}
                        <span>{TOOL_LABEL[s.name] || s.name}</span>
                        {s.summary ? <span className="dim ellipsis" style={{ flex: 1 }}>{s.summary}</span> : null}
                      </div>
                      {s.image ? <img src={s.image} /> : null}
                    </div>
                  ))}
                </div>
              ) : null}
              {m.text ? <div>{m.text}</div> : !m.done ? <div className="dim">思考中…</div> : null}
              {m.error ? <div className="ai-step err" style={{ marginTop: 6 }}><Icon name="circle-alert" size={13} /><span>{m.error}{m.hint ? `（${m.hint}）` : ''}</span></div> : null}
              {m.cancelled ? <div className="dim" style={{ marginTop: 4 }}>已停止</div> : null}
            </div>
          )))}
      </div>
      <div className="ai-input">
        {!busy ? <div className="ai-suggest">{suggestions.map((s) => <button key={s} className="chip" onClick={() => send(s)}>{s}</button>)}</div> : null}
        <div className="box">
          <textarea ref={taRef} value={input} placeholder={selBlock ? '针对选中的元素提要求，或描述整体修改…' : '描述你想要的修改，例如：把第三页改成对比图'} rows={2}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } e.stopPropagation(); }} />
          <div className="row">
            <span className="dim" style={{ fontSize: 11 }}>{selBlock ? '已附带选中元素' : sel.scene ? '已附带当前场景' : ''}</span>
            <div className="spacer" />
            {busy ? <button className="btn sm danger" onClick={stop}><Icon name="circle-stop" size={13} />停止</button>
              : <button className="btn sm ai" disabled={!input.trim()} onClick={() => send()}><Icon name="send" size={13} />发送</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

export async function aiQuick(prompt) {
  window.__motifAiPrompt = { prompt, send: true };
  dispatchEvent(new CustomEvent('motif:open-ai', { detail: { prompt } }));
  void toast;
}
