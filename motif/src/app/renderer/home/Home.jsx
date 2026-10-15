// Library home: create (template / import / AI), browse and manage works.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../icons.jsx';
import { call, fmtWhen, platform } from '../api.js';
import { Modal, Field, Segmented, Select, Spinner, toast, openMenu, confirmDialog, promptDialog, Progress } from '../ui.jsx';
import { BUILTIN_TEMPLATES } from '../../../core/templates/index.js';
import { THEMES } from '../../../core/themes/index.js';
import { renderThumb, playPreview } from './preview.js';

export function Home({ onOpen, request, clearRequest }) {
  const [projects, setProjects] = useState(null);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('updated');
  const [modal, setModal] = useState(null);
  const [importFiles, setImportFiles] = useState(null);
  const load = () => call('library.list').then(setProjects).catch((e) => { toast.error(e); setProjects([]); });
  useEffect(() => { load(); const t = setInterval(load, 8000); return () => clearInterval(t); }, []);
  useEffect(() => {
    if (!request) return;
    if (request.kind === 'new') setModal('new');
    if (request.kind === 'import') { setImportFiles(request.files || []); setModal('import'); }
    if (request.kind === 'ai') setModal('ai');
    clearRequest?.();
  }, [request]);

  const list = useMemo(() => {
    let l = (projects || []).filter((p) => !q || p.title.toLowerCase().includes(q.toLowerCase()) || (p.tags || []).some((t) => t.includes(q)));
    if (sort === 'title') l = l.slice().sort((a, b) => a.title.localeCompare(b.title, 'zh'));
    return l;
  }, [projects, q, sort]);

  const menu = (e, p) => openMenu(e, [
    { label: '打开', icon: 'folder-open', onClick: () => onOpen(p.id) },
    { label: '重命名', icon: 'pen-line', onClick: async () => { const t = await promptDialog({ title: '重命名作品', value: p.title }); if (t) { await call('project.apply', p.id, [{ op: 'set_title', title: t }], { message: '重命名' }); load(); } } },
    { label: '创建副本', icon: 'copy', onClick: async () => { await call('project.duplicate', p.id); load(); } },
    { label: '另存为模板…', icon: 'layout-template', onClick: async () => { const n = await promptDialog({ title: '另存为模板', label: '模板名称', value: p.title }); if (n) { await call('project.saveAsTemplate', p.id, { name: n }); toast.ok('已保存为模板，可在「新建」中使用'); } } },
    { label: '在文件夹中显示', icon: 'folder', onClick: () => call('shell.reveal', `${p.path}/project.json`) },
    '-',
    { label: '删除', icon: 'trash', danger: true, onClick: async () => { if (await confirmDialog({ title: `删除「${p.title}」？`, message: '作品会移到素材库的 .trash 文件夹，可手动找回。', ok: '删除', danger: true })) { await call('project.delete', p.id); load(); } } },
  ]);

  return (
    <div className="home">
      <div className={`titlebar ${platform === 'darwin' ? 'mac' : 'win'}`}>
        <div className="brand"><span className="logo" />Motif <span className="dim" style={{ fontWeight: 500 }}>律影</span></div>
        <div className="drag grow" />
        <button className="btn ghost" onClick={() => dispatchEvent(new CustomEvent('motif:integrations'))}><Icon name="plug" size={15} />AI 集成</button>
        <button className="ibtn" title="设置" onClick={() => dispatchEvent(new CustomEvent('motif:settings'))}><Icon name="settings" size={16} /></button>
      </div>
      <div className="home-body">
        <div className="home-inner">
          <div className="hero">
            <div className="hero-card main" onClick={() => setModal('new')}>
              <span className="kbd-hint">Ctrl+N</span>
              <span className="hico"><Icon name="plus" size={20} /></span>
              <h3>新建作品</h3>
              <p>从精心设计的模板开始：发布会、年报、路演、数学课、短视频、品牌故事……</p>
            </div>
            <div className="hero-card import" onClick={() => { setImportFiles([]); setModal('import'); }}>
              <span className="kbd-hint">Ctrl+I</span>
              <span className="hico"><Icon name="file-up" size={20} /></span>
              <h3>导入素材，自动设计</h3>
              <p>PPT、Word、Excel、PDF、Markdown、图片 → 专业动态视觉</p>
            </div>
            <div className="hero-card ai" onClick={() => setModal('ai')}>
              <span className="hico"><Icon name="sparkles" size={20} /></span>
              <h3>用 AI 创作</h3>
              <p>描述你要讲的内容，AI 写结构与文案，Motif 完成设计与动画</p>
            </div>
          </div>
          <div className="lib-head">
            <h2>我的作品</h2>
            <span className="badge">{projects?.length ?? '…'}</span>
            <div className="spacer" />
            <div className="search"><span className="ico"><Icon name="search" size={14} /></span><input className="input" placeholder="搜索作品" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <Select value={sort} style={{ width: 120, height: 32 }} options={[{ value: 'updated', label: '最近修改' }, { value: 'title', label: '按标题' }]} onChange={setSort} />
          </div>
          {!projects ? <div className="grid-cards">{[0, 1, 2, 3].map((i) => <div key={i} className="pcard"><div className="thumb skeleton" /></div>)}</div>
            : list.length ? (
              <div className="grid-cards">
                {list.map((p) => (
                  <div key={p.id} className="pcard" onClick={() => onOpen(p.id)} onContextMenu={(e) => menu(e, p)}>
                    <div className={`thumb ${p.aspect && p.aspect !== '16:9' && p.aspect !== '21:9' && p.aspect !== '4:3' ? 'portrait' : ''}`}>
                      {p.thumbUrl ? <img src={p.thumbUrl} draggable={false} /> : <Icon name="film" size={26} style={{ color: 'var(--fg3)' }} />}
                      <div className="corner">
                        {p.lastAuthor === 'ai' ? <span className="badge ai"><Icon name="bot" size={10} />AI 编辑</span> : null}
                        {p.aspect && p.aspect !== '16:9' ? <span className="badge">{p.aspect}</span> : null}
                      </div>
                    </div>
                    <div className="meta">
                      <div className="grow" style={{ minWidth: 0 }}>
                        <div className="name ellipsis">{p.title}</div>
                        <div className="sub">{THEMES[p.theme]?.name?.split(' ')[0] || p.theme} · {p.scenes} 个场景 · {fmtWhen(p.updatedAt)}</div>
                      </div>
                      <button className="ibtn sm more" onClick={(e) => { e.stopPropagation(); menu(e, p); }}><Icon name="ellipsis" size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty" style={{ padding: 60 }}>
                <div className="ico"><Icon name="film" size={22} /></div>
                <div style={{ color: 'var(--fg0)', fontSize: 14 }}>{q ? '没有匹配的作品' : '素材库还是空的'}</div>
                {!q ? <div>新建一个作品，或导入一份 PPT / 文档，看看 Motif 能把它变成什么样。</div> : null}
              </div>
            )}
        </div>
      </div>
      {modal === 'new' ? <NewProject onClose={() => setModal(null)} onCreated={(id) => { setModal(null); onOpen(id); }} /> : null}
      {modal === 'import' ? <ImportWizard initial={importFiles} onClose={() => setModal(null)} onCreated={(id) => { setModal(null); onOpen(id); }} /> : null}
      {modal === 'ai' ? <AICreate onClose={() => setModal(null)} onCreated={(id) => { setModal(null); onOpen(id); }} /> : null}
    </div>
  );
}

// ───────────────────────────── new from template ─────────────────────────────
function TemplateCard({ t, on, onClick, onDouble }) {
  const ref = useRef(null);
  const stop = useRef(null);
  const portrait = t.aspect === '9:16' || t.aspect === '4:5';
  useEffect(() => {
    if (!ref.current) return;
    if (t.builtin) renderThumb(BUILTIN_TEMPLATES.find((x) => x.id === t.id).doc, ref.current, { width: 300 });
    else call('templates.get', t.id).then((r) => renderThumb(r.doc, ref.current, { assetBase: r.assetBase, width: 300 })).catch(() => {});
  }, [t.id]);
  const enter = async () => {
    if (!ref.current) return;
    const doc = t.builtin ? BUILTIN_TEMPLATES.find((x) => x.id === t.id).doc : (await call('templates.get', t.id)).doc;
    stop.current?.();
    stop.current = playPreview(doc, ref.current);
  };
  const leave = () => { stop.current?.(); stop.current = null; if (ref.current && t.builtin) renderThumb(BUILTIN_TEMPLATES.find((x) => x.id === t.id).doc, ref.current, { width: 300 }); };
  useEffect(() => () => stop.current?.(), []);
  return (
    <button className={`tpl ${on ? 'on' : ''}`} onClick={onClick} onDoubleClick={onDouble} onMouseEnter={enter} onMouseLeave={leave}>
      <div className="pv" style={portrait ? { aspectRatio: '16/9', display: 'grid', placeItems: 'center' } : null}><canvas ref={ref} style={portrait ? { height: '100%', width: 'auto' } : null} /></div>
      <div className="tx">
        <b>{t.name}{!t.builtin ? <span className="badge" style={{ marginLeft: 6 }}>我的</span> : null}</b>
        <span>{t.description}</span>
        <div className="row" style={{ marginTop: 6, gap: 4 }}><span className="badge">{t.scenes} 场景</span><span className="badge">{t.aspect}</span><span className="badge">{THEMES[t.theme]?.name?.split(' ')[0] || t.theme}</span></div>
      </div>
    </button>
  );
}

function NewProject({ onClose, onCreated }) {
  const [tpls, setTpls] = useState(null);
  const [pick, setPick] = useState(null);
  const [title, setTitle] = useState('');
  const [aspect, setAspect] = useState(null);
  const [theme, setTheme] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { call('templates.list').then((l) => { setTpls(l); }).catch(() => setTpls(BUILTIN_TEMPLATES.map((t) => ({ id: t.id, name: t.name, description: t.description, builtin: true, scenes: t.doc.scenes.length, aspect: t.doc.format?.aspect || '16:9', theme: t.doc.theme?.id })))); }, []);
  const create = async (tpl = pick) => {
    setBusy(true);
    try {
      const r = await call('project.create', { title: title.trim() || undefined, template: tpl === 'blank' ? undefined : tpl || undefined, aspect: aspect || undefined, theme: theme || undefined });
      onCreated(r.id);
    } catch (e) { toast.error(e); setBusy(false); }
  };
  return (
    <Modal title="新建作品" sub="模板只是起点：每个元素、场景和动画都可以修改，AI 也能在此基础上继续创作" icon="plus" onClose={onClose} width={1080}
      footer={<>
        <input className="input" style={{ width: 240 }} placeholder="作品标题（可稍后修改）" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Select value={aspect || ''} style={{ width: 150 }} placeholder="模板默认画幅" options={['16:9', '9:16', '1:1', '4:5', '4:3', '21:9'].map((a) => ({ value: a, label: a }))} onChange={(v) => setAspect(v || null)} />
        <Select value={theme} style={{ width: 160 }} placeholder="模板默认主题" options={Object.values(THEMES).map((t) => ({ value: t.id, label: t.name }))} onChange={setTheme} />
        <div className="spacer" />
        <button className="btn" onClick={onClose}>取消</button>
        <button className="btn primary" disabled={!pick || busy} onClick={() => create()}>{busy ? <Spinner size={14} /> : null}创建</button>
      </>}>
      {!tpls ? <div className="empty"><Spinner /></div> : (
        <div className="tpl-grid">
          <button className={`tpl ${pick === 'blank' ? 'on' : ''}`} onClick={() => setPick('blank')} onDoubleClick={() => create('blank')}>
            <div className="pv" style={{ display: 'grid', placeItems: 'center', background: 'var(--bg3)' }}><Icon name="plus" size={28} style={{ color: 'var(--fg2)' }} /></div>
            <div className="tx"><b>空白作品</b><span>从零开始，或交给 AI 助手生成</span></div>
          </button>
          {tpls.map((t) => <TemplateCard key={t.id} t={t} on={pick === t.id} onClick={() => setPick(t.id)} onDouble={() => create(t.id)} />)}
        </div>
      )}
    </Modal>
  );
}

// ───────────────────────────── import wizard ─────────────────────────────
const ACCEPT = ['pptx', 'docx', 'xlsx', 'xlsm', 'pdf', 'md', 'markdown', 'txt', 'csv', 'tsv', 'json', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'];
const KIND_LABEL = { pptx: '演示文稿', docx: '文档', xlsx: '表格', pdf: 'PDF', markdown: 'Markdown', text: '文本', csv: '数据', json: '数据', image: '图片' };

function ImportWizard({ initial, onClose, onCreated }) {
  const [files, setFiles] = useState(initial || []);
  const [outline, setOutline] = useState(null);
  const [busy, setBusy] = useState(null);
  const [theme, setTheme] = useState('');
  const [aspect, setAspect] = useState('16:9');
  const [over, setOver] = useState(false);
  const [title, setTitle] = useState('');

  useEffect(() => { if (files.length) analyze(files); }, []);
  const analyze = async (fs) => {
    setBusy('analyze'); setOutline(null);
    try { const o = await call('import.analyze', fs); setOutline(o); setTitle(o.title || ''); }
    catch (e) { toast.error(e); }
    finally { setBusy(null); }
  };
  const add = (paths) => { const fs = [...new Set([...files, ...paths])].filter((f) => ACCEPT.includes(f.split('.').pop().toLowerCase())); if (fs.length !== files.length + paths.length && paths.length) toast('已忽略不支持的文件'); setFiles(fs); if (fs.length) analyze(fs); };
  const browse = async () => add(await call('dialog.open', { title: '选择素材', multi: true, filters: [{ name: '支持的素材', extensions: ACCEPT }] }));
  const create = async () => {
    setBusy('create');
    try { const r = await call('import.auto', files, { title: title || undefined, theme: theme || undefined, aspect }); onCreated(r.id); }
    catch (e) { toast.error(e); setBusy(null); }
  };
  const ins = outline?.insights;
  const sections = outline?.sections || [];
  return (
    <Modal title="导入素材，自动设计" sub="Motif 会理解结构、识别数据与重点，再用设计系统重新组织成动态视觉" icon="file-up" onClose={busy === 'create' ? undefined : onClose} width={760}
      footer={<>
        {outline ? <>
          <span className="muted">主题</span>
          <Select value={theme} style={{ width: 150 }} placeholder="自动推荐" options={Object.values(THEMES).map((t) => ({ value: t.id, label: t.name }))} onChange={setTheme} />
          <Segmented value={aspect} options={['16:9', '9:16', '1:1'].map((a) => ({ value: a, label: a }))} onChange={setAspect} />
        </> : null}
        <div className="spacer" />
        <button className="btn" onClick={onClose} disabled={busy === 'create'}>取消</button>
        <button className="btn primary" disabled={!outline || !!busy} onClick={create}>{busy === 'create' ? <Spinner size={14} /> : <Icon name="wand-sparkles" size={14} />}生成作品</button>
      </>}>
      <div className={`drop-zone ${over ? 'over' : ''}`} style={{ padding: files.length ? 14 : 34 }}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); add([...e.dataTransfer.files].map((f) => window.motif?.pathOf(f)).filter(Boolean)); }}
        onClick={browse}>
        {files.length ? (
          <div className="row" style={{ flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
            {files.map((f) => <span key={f} className="badge" style={{ height: 24 }}><Icon name="file-text" size={12} />{f.split(/[\\/]/).pop()}</span>)}
            <span className="dim">· 点击或拖入添加更多</span>
          </div>
        ) : (
          <div className="col" style={{ alignItems: 'center', gap: 8 }}>
            <Icon name="file-up" size={28} />
            <div style={{ fontSize: 14, color: 'var(--fg0)' }}>拖入文件，或点击选择</div>
            <div className="dim">PPTX · DOCX · XLSX · PDF · Markdown · TXT · CSV · JSON · 图片（可多选，合并为一部作品）</div>
          </div>
        )}
      </div>
      {busy === 'analyze' ? <div className="col" style={{ gap: 8, marginTop: 16 }}><div className="row"><Spinner size={14} />正在分析结构、表格与关键数字…</div><Progress indeterminate /></div> : null}
      {busy === 'create' ? <div className="col" style={{ gap: 8, marginTop: 16 }}><div className="row"><Spinner size={14} />正在设计场景、选择图表与版式…</div><Progress indeterminate /></div> : null}
      {outline && busy !== 'create' ? (
        <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 230px', gap: 16 }}>
          <div>
            <Field label="作品标题"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
            <div className="dim" style={{ margin: '10px 0 6px', fontSize: 11.5 }}>识别到的结构</div>
            <div className="outline">
              {sections.slice(0, 40).map((s, i) => (
                <div key={i} className="sec">
                  <b>{s.title || '（无标题）'}</b> <span className="dim" style={{ fontSize: 11 }}>{s.source}</span>
                  <div className="its">
                    {s.items.slice(0, 8).map((it, k) => (
                      <span key={k} className={`badge ${it.kind === 'table' && it.analysis?.chart ? 'acc' : it.kind === 'image' ? 'ok' : ''}`}>
                        {it.kind === 'table' ? (it.analysis?.chart ? `表格 → ${{ bar: '柱状图', line: '折线图', donut: '环形图', hbar: '条形图' }[it.analysis.chart] || it.analysis.chart}` : '表格')
                          : it.kind === 'chart' ? `图表 · ${it.chart?.kind || ''}` : it.kind === 'bullets' ? `要点 ×${it.items?.length}` : it.kind === 'image' ? '图片' : it.kind === 'equation' ? '公式' : it.kind === 'quote' ? '引言'
                            : it.numbers?.length ? `数字 ${it.numbers.slice(0, 2).map((n) => n.value).join(' ')}` : '段落'}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="col" style={{ gap: 10 }}>
            <div className="card" style={{ padding: 12 }}>
              <div className="dim" style={{ fontSize: 11.5, marginBottom: 6 }}>素材分析</div>
              <div className="kv" style={{ gridTemplateColumns: '1fr auto', fontSize: 12 }}>
                <div>章节</div><div>{sections.length}</div>
                <div>数据表 / 图表</div><div>{ins?.counts.tables} / {ins?.counts.charts}</div>
                <div>要点列表</div><div>{ins?.counts.bullets}</div>
                <div>关键数字</div><div>{ins?.counts.numbers}</div>
                <div>图片</div><div>{outline.media?.length || 0}</div>
              </div>
            </div>
            {ins?.topics?.length ? <div className="card" style={{ padding: 12 }}><div className="dim" style={{ fontSize: 11.5, marginBottom: 6 }}>内容主题</div><div className="chip-row">{ins.topics.map((t) => <span key={t} className="chip on">{{ math: '数学/科学', finance: '财务经营', tech: '科技产品', engineering: '工程架构', education: '教育', culture: '文化', marketing: '营销', pitch: '融资路演' }[t] || t}</span>)}</div></div> : null}
            <div className="dim" style={{ fontSize: 11.5, lineHeight: 1.6 }}>生成后可以在编辑器中逐项修改，或让 AI 助手继续润色。原始文件不会被改动。</div>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

// ───────────────────────────── create with AI ─────────────────────────────
function AICreate({ onClose, onCreated }) {
  const [text, setText] = useState('');
  const [aspect, setAspect] = useState('16:9');
  const [theme, setTheme] = useState('');
  const [prov, setProv] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { call('ai.providers').then(setProv).catch(() => setProv({ providers: [] })); }, []);
  const go = async () => {
    setBusy(true);
    try {
      const firstLine = text.trim().split('\n')[0].slice(0, 24);
      const r = await call('project.create', { title: firstLine || 'AI 作品', aspect, theme: theme || undefined });
      window.__motifAiPrompt = { prompt: `请根据下面的内容为这部空白作品创作完整的动态视觉（${aspect} 画幅${theme ? `，主题 ${theme}` : '，选择最合适的主题'}）：先规划 6–10 个场景的叙事结构，再用 motif_write_document 一次写入，最后运行 motif_lint 修正问题。\n\n${text.trim()}`, send: true };
      onCreated(r.id);
    } catch (e) { toast.error(e); setBusy(false); }
  };
  const noModel = prov && !prov.providers.length;
  return (
    <Modal title="用 AI 创作" sub="AI 负责结构与文案，Motif 负责版式、动画、转场与镜头" icon="sparkles" onClose={onClose} width={640}
      footer={<>
        <Segmented value={aspect} options={['16:9', '9:16', '1:1'].map((a) => ({ value: a, label: a }))} onChange={setAspect} />
        <Select value={theme} style={{ width: 150 }} placeholder="主题：AI 选择" options={Object.values(THEMES).map((t) => ({ value: t.id, label: t.name }))} onChange={setTheme} />
        <div className="spacer" />
        <button className="btn" onClick={onClose}>取消</button>
        {noModel ? <button className="btn ai" onClick={() => { onClose(); dispatchEvent(new CustomEvent('motif:settings', { detail: { tab: 'ai' } })); }}>先添加 AI 模型</button>
          : <button className="btn ai" disabled={!text.trim() || busy} onClick={go}>{busy ? <Spinner size={14} /> : <Icon name="sparkles" size={14} />}开始创作</button>}
      </>}>
      <textarea className="textarea" autoFocus rows={9} style={{ minHeight: 200 }} value={text} onChange={(e) => setText(e.target.value)}
        placeholder={'描述要做的内容，或直接粘贴素材文字。例如：\n\n为我们的新产品「Motif Cloud」做一支 60 秒发布视频：\n- 痛点：数据分散、报表要等一周\n- 方案：十分钟接入，实时看板\n- 数据：内测 120 家企业，效率提升 3 倍\n- 结尾：即日起开放申请'} />
      {noModel ? <div className="ai-step" style={{ marginTop: 10 }}><Icon name="info" size={14} />需要先在 设置 → AI 模型 中连接一个模型（云端或本地均可）。</div> : null}
    </Modal>
  );
}
