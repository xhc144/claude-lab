// App shell: library ⇄ editor routing, global dialogs, file opening from the OS.
import { useCallback, useEffect, useState } from 'react';
import { Home } from './home/Home.jsx';
import { Editor } from './editor/Editor.jsx';
import { Settings } from './settings/Settings.jsx';
import { Toasts, Menus, Dialogs, toast } from './ui.jsx';
import { call, on, isElectron } from './api.js';
import { RecordingStatus } from './record/RecordDialog.jsx';
import { applyAppearance } from './theme.js';

export function App() {
  const [route, setRoute] = useState(() => { try { const r = JSON.parse(sessionStorage.getItem('motif.route') || 'null'); return r || { view: 'home' }; } catch { return { view: 'home' }; } });
  const [settings, setSettings] = useState(null);
  const [homeRequest, setHomeRequest] = useState(null);

  useEffect(() => { try { sessionStorage.setItem('motif.route', JSON.stringify(route)); } catch { /* ignore */ } }, [route]);

  const openFiles = useCallback(async (files) => {
    if (!files?.length) return;
    const proj = files.find((f) => /project\.json$/i.test(f) || !/\.[a-z0-9]+$/i.test(f));
    if (proj) {
      try { const r = await call('project.open', proj.replace(/[\\/]project\.json$/i, '')); setRoute({ view: 'editor', id: r.id }); return; }
      catch (e) { toast.error(e); }
    }
    setRoute({ view: 'home' });
    setHomeRequest({ kind: 'import', files });
  }, []);

  useEffect(() => { if (isElectron) call('config.get').then((c) => applyAppearance(c.appearance || 'dark')).catch(() => {}); }, []);

  useEffect(() => {
    if (!isElectron) return;
    call('app.pendingOpen').then(openFiles).catch(() => {});
    const offs = [
      on('open-files', openFiles),
      on('command', (cmd) => {
        if (cmd === 'home') setRoute({ view: 'home' });
        if (cmd === 'new') { setRoute({ view: 'home' }); setHomeRequest({ kind: 'new' }); }
        if (cmd === 'import') { setRoute({ view: 'home' }); setHomeRequest({ kind: 'import', files: [] }); }
        if (cmd === 'shortcuts') setSettings('shortcuts');
        if (cmd === 'integrations') setSettings('integrations');
      }),
    ];
    const ev = [
      ['motif:settings', (e) => setSettings(e.detail?.tab || 'general')],
      ['motif:integrations', () => setSettings('integrations')],
      ['motif:open-project', (e) => { if (e.detail?.id) setRoute({ view: 'editor', id: e.detail.id }); }],
    ].map(([n, f]) => { addEventListener(n, f); return () => removeEventListener(n, f); });
    return () => [...offs, ...ev].forEach((f) => f());
  }, [openFiles]);

  // keyboard: Ctrl+N / Ctrl+I from anywhere
  useEffect(() => {
    const k = (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      if (e.key.toLowerCase() === 'n') { e.preventDefault(); setRoute({ view: 'home' }); setHomeRequest({ kind: 'new' }); }
      if (e.key.toLowerCase() === 'i') { e.preventDefault(); setRoute({ view: 'home' }); setHomeRequest({ kind: 'import', files: [] }); }
      if (e.key === ',') { e.preventDefault(); setSettings('general'); }
    };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, []);

  // dropping documents anywhere on the library starts an import
  const [dropping, setDropping] = useState(false);
  useEffect(() => {
    if (route.view !== 'home') return;
    let n = 0;
    const enter = (e) => { if (e.dataTransfer?.types?.includes('Files')) { n++; setDropping(true); } };
    const leave = () => { n = Math.max(0, n - 1); if (!n) setDropping(false); };
    const over = (e) => { if (e.dataTransfer?.types?.includes('Files')) e.preventDefault(); };
    const drop = (e) => { n = 0; setDropping(false); if (e.defaultPrevented) return; e.preventDefault(); const fs = [...e.dataTransfer.files].map((f) => window.motif?.pathOf(f)).filter(Boolean); if (fs.length) openFiles(fs); };
    addEventListener('dragenter', enter); addEventListener('dragleave', leave); addEventListener('dragover', over); addEventListener('drop', drop);
    return () => { removeEventListener('dragenter', enter); removeEventListener('dragleave', leave); removeEventListener('dragover', over); removeEventListener('drop', drop); };
  }, [route.view, openFiles]);

  return (
    <>
      {route.view === 'editor'
        ? <Editor key={route.id} projectId={route.id} onHome={() => setRoute({ view: 'home' })} onCommand={(cmd) => { if (cmd === 'shortcuts') setSettings('shortcuts'); }} />
        : <Home onOpen={(id) => setRoute({ view: 'editor', id })} request={homeRequest} clearRequest={() => setHomeRequest(null)} />}
      {settings ? <Settings initialTab={settings} onClose={() => setSettings(null)} /> : null}
      {dropping ? <div className="global-drop"><div>松开以导入素材<br /><span className="dim" style={{ fontSize: 13 }}>PPTX · DOCX · XLSX · PDF · Markdown · 图片</span></div></div> : null}
      <RecordingStatus onOpen={(id) => setRoute({ view: 'editor', id })} />
      <Toasts />
      <Menus />
      <Dialogs />
    </>
  );
}
