// The motif:// scheme serves the app bundle and local files under one origin so canvases that
// draw project images stay untainted (pixels can be read back for export).
//   motif://app/<file in dist>           application files
//   motif://app/@file/<encoded abs path>  files inside allowed roots (library, project, temp)
import { protocol, net } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const allowedRoots = new Set();
export function allowRoot(dir) { if (dir) allowedRoots.add(path.resolve(dir)); }

export function registerSchemePrivileges() {
  protocol.registerSchemesAsPrivileged([{ scheme: 'motif', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.pdf': 'application/pdf' };

export function handleProtocol(distDir) {
  protocol.handle('motif', async (req) => {
    const u = new URL(req.url);
    let rel = decodeURIComponent(u.pathname);
    let file;
    if (rel.startsWith('/@file/')) {
      const raw = rel.slice('/@file/'.length);
      file = process.platform === 'win32' ? path.resolve(raw.replace(/^\/+/, '')) : path.resolve('/' + raw.replace(/^\/+/, ''));
      const ok = [...allowedRoots].some((r) => file === r || file.startsWith(r + path.sep));
      if (!ok) return new Response('forbidden', { status: 403 });
    } else {
      file = path.join(distDir, rel.replace(/^\/+/, '') || 'index.html');
      if (!file.startsWith(distDir)) return new Response('forbidden', { status: 403 });
    }
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return new Response('not found', { status: 404 });
    const res = await net.fetch(pathToFileURL(file).toString(), { headers: req.headers });
    const headers = new Headers(res.headers);
    const t = TYPES[path.extname(file).toLowerCase()];
    if (t) headers.set('content-type', t);
    headers.set('access-control-allow-origin', '*');
    headers.set('cache-control', 'no-store');
    return new Response(res.body, { status: res.status, headers });
  });
}

/** URL for a local file through the scheme. */
export function fileUrl(p) {
  const abs = path.resolve(p).replace(/\\/g, '/');
  return 'motif://app/@file/' + abs.split('/').map(encodeURIComponent).join('/').replace(/^\/+/, '');
}
