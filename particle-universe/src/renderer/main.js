import '@fontsource-variable/inter';
import '@fontsource-variable/outfit';
import { App } from './core/app.js';
import { UI } from './ui/ui.js';
import { platform } from './core/platform.js';
import { runSmoke } from './core/smoke.js';

function fatal(title, err) {
  const el = document.getElementById('fatal');
  el.classList.add('on');
  el.innerHTML = `<div class="box"><h2>${title}</h2><p>音乐粒子宇宙需要支持 WebGL2 与浮点渲染的显卡。请更新显卡驱动，或在笔记本上为本程序选择独立显卡后重试。</p><pre></pre></div>`;
  el.querySelector('pre').textContent = String(err && (err.stack || err.message) || err);
  if (new URLSearchParams(location.search).has('smoke')) platform.smoke.result({ ok: false, error: String(err && err.message || err) });
}

async function boot() {
  const canvas = document.getElementById('gl');
  let app;
  try {
    app = new App(canvas);
  } catch (e) {
    console.error(e);
    fatal('无法启动图形引擎', e);
    return;
  }
  window.__app = app;
  const ui = new UI(app);
  window.__ui = ui;
  try {
    await app.init();
  } catch (e) {
    console.error(e);
    fatal('初始化失败', e);
    return;
  }
  requestAnimationFrame(() => document.body.classList.remove('booting'));
  if (new URLSearchParams(location.search).has('smoke')) runSmoke(app, ui);
}

window.addEventListener('error', (e) => console.error('uncaught', e.error || e.message));
window.addEventListener('unhandledrejection', (e) => console.error('unhandled', e.reason));
boot();
