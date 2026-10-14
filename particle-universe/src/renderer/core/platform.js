// Host abstraction: Electron (preload bridge) or a plain browser.
const pu = typeof window !== 'undefined' ? window.pu : null;

const AUDIO_ACCEPT = '.mp3,.flac,.wav,.ogg,.oga,.opus,.m4a,.aac,.mp4,.webm,.weba,audio/*';
export const AUDIO_EXT = /\.(mp3|flac|wav|ogg|oga|opus|m4a|aac|mp4|webm|weba|wma)$/i;

const basename = (p) => p.split(/[\\/]/).pop();

export const platform = {
  electron: !!pu,

  async info() { return pu ? await pu.info() : { version: 'web', platform: 'web', packaged: false }; },
  async gpu() { return pu ? await pu.gpu() : null; },

  // → [{ name, path?, file? }]
  async pickAudio() {
    if (pu) {
      const paths = await pu.openAudioDialog();
      return paths.map((p) => ({ name: basename(p), path: p }));
    }
    return await new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = AUDIO_ACCEPT;
      input.multiple = true;
      input.onchange = () => resolve([...input.files].map((f) => ({ name: f.name, file: f })));
      input.oncancel = () => resolve([]);
      input.click();
    });
  },

  fromFiles(files) {
    return [...files].filter((f) => AUDIO_EXT.test(f.name) || (f.type || '').startsWith('audio/')).map((f) => {
      const path = pu ? pu.pathForFile(f) : '';
      return path ? { name: f.name, path, file: f } : { name: f.name, file: f };
    });
  },

  async read(item) {
    if (item.file) return await item.file.arrayBuffer();
    if (item.path && pu) {
      const u8 = await pu.readFile(item.path);
      return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
    }
    throw new Error('无法读取文件');
  },

  async exists(path) { return pu ? !!(await pu.statFile(path)) : false; },

  async pendingFiles() { return pu ? (await pu.pendingFiles()).map((p) => ({ name: basename(p), path: p })) : []; },
  onOpenFiles(cb) { if (pu) pu.onOpenFiles((paths) => cb(paths.map((p) => ({ name: basename(p), path: p })))); },

  // Streaming writer for exported video: { write(data, position), close(), abort(), path }
  async videoWriter(defaultName, ext) {
    if (pu) {
      const path = await pu.saveVideoDialog(defaultName, ext);
      if (!path) return null;
      const id = await pu.fileOpen(path);
      const pending = new Set();
      let failed = null;
      return {
        path,
        write(data, position) {
          const copy = data.slice();
          const p = pu.fileWrite(id, copy, position).catch((e) => { failed = e; });
          pending.add(p);
          p.finally(() => pending.delete(p));
          if (failed) throw failed;
        },
        async close() { await Promise.all([...pending]); await pu.fileClose(id); if (failed) throw failed; },
        async abort() { await Promise.all([...pending]).catch(() => {}); await pu.fileClose(id); await pu.fileRemove(path); }
      };
    }
    if (window.showSaveFilePicker) {
      let handle;
      try {
        handle = await window.showSaveFilePicker({ suggestedName: defaultName, types: [{ description: ext.toUpperCase() + ' 视频', accept: { [ext === 'webm' ? 'video/webm' : 'video/mp4']: ['.' + ext] } }] });
      } catch { return null; }
      const ws = await handle.createWritable();
      let chain = Promise.resolve();
      return {
        path: handle.name,
        write(data, position) { const copy = data.slice(); chain = chain.then(() => ws.write({ type: 'write', position, data: copy })); },
        async close() { await chain; await ws.close(); },
        async abort() { await chain.catch(() => {}); await ws.abort(); }
      };
    }
    // in-memory fallback → download
    const parts = [];
    let size = 0;
    return {
      path: defaultName,
      write(data, position) { parts.push({ position, data: data.slice() }); size = Math.max(size, position + data.byteLength); },
      async close() {
        const buf = new Uint8Array(size);
        for (const p of parts) buf.set(p.data, p.position);
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([buf], { type: ext === 'webm' ? 'video/webm' : 'video/mp4' }));
        a.download = defaultName;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 30000);
      },
      async abort() { parts.length = 0; }
    };
  },

  async saveImage(blob, name) {
    if (pu) {
      const paths = await pu.paths();
      const p = paths.pictures + (navigator.userAgent.includes('Windows') ? '\\' : '/') + name;
      await pu.writeFile(p, new Uint8Array(await blob.arrayBuffer()));
      return p;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 30000);
    return null;
  },

  showItem(p) { if (pu && p) pu.showItem(p); },
  canReveal: !!pu,

  async toggleFullscreen() {
    if (pu) return await pu.toggleFullscreen();
    if (document.fullscreenElement) { await document.exitFullscreen(); return false; }
    await document.documentElement.requestFullscreen();
    return true;
  },
  async setFullscreen(v) {
    if (pu) return await pu.setFullscreen(v);
    if (v && !document.fullscreenElement) await document.documentElement.requestFullscreen();
    if (!v && document.fullscreenElement) await document.exitFullscreen();
    return v;
  },
  onFullscreen(cb) {
    if (pu) pu.onFullscreen(cb);
    else document.addEventListener('fullscreenchange', () => cb(!!document.fullscreenElement));
  },
  setProgress(v) { if (pu) pu.setProgress(v); },
  preventSleep(on) { if (pu) pu.preventSleep(on); },
  smoke: pu ? { log: (m) => pu.smokeLog(m), result: (r) => pu.smokeResult(r) } : { log: (m) => console.log('[smoke]', m), result: (r) => { window.__smokeResult = r; console.log('SMOKE', JSON.stringify(r)); } }
};
