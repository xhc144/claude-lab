// Minimal static file server (used by tests, the snapshot tool and the dev player).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json' };

/** mounts: { '/': dir, '/assets/': dir2 } */
export function serve(mounts, port = 0) {
  const entries = Object.entries(mounts).sort((a, b) => b[0].length - a[0].length);
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    for (const [prefix, dir] of entries) {
      if (!url.startsWith(prefix)) continue;
      const file = path.join(dir, url.slice(prefix.length) || 'index.html');
      if (!file.startsWith(path.resolve(dir))) break;
      if (fs.existsSync(file) && fs.statSync(file).isFile()) {
        res.writeHead(200, { 'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'access-control-allow-origin': '*', 'cache-control': 'no-store' });
        fs.createReadStream(file).pipe(res);
        return;
      }
    }
    res.writeHead(404); res.end('not found');
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({ server, port: server.address().port, close: () => new Promise((r) => server.close(r)) })));
}
