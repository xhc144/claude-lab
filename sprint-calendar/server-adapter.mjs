import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { Readable } from "node:stream";
import handler from "./dist/server/index.js";

const root = path.resolve("dist/client");
const port = Number(process.env.PORT || 3001);
const host = process.env.HOST || "127.0.0.1";

const mime = {
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function assetPath(url) {
  const pathname = new URL(url).pathname.replace(/^\/sprint\//, "/");
  const candidate = path.resolve(root, `.${pathname}`);
  return candidate.startsWith(`${root}${path.sep}`) ? candidate : null;
}

const assets = {
  async fetch(request) {
    const filename = assetPath(request.url);
    if (!filename) return new Response("Not Found", { status: 404 });
    try {
      const info = await stat(filename);
      if (!info.isFile()) return new Response("Not Found", { status: 404 });
      return new Response(createReadStream(filename), {
        headers: {
          "content-type": mime[path.extname(filename)] || "application/octet-stream",
          "content-length": String(info.size),
          "cache-control": "public, max-age=31536000, immutable",
        },
      });
    } catch {
      return new Response("Not Found", { status: 404 });
    }
  },
};

const server = http.createServer(async (request, response) => {
  try {
    const scheme = request.headers["x-forwarded-proto"] || "http";
    const url = new URL(request.url || "/", `${scheme}://${request.headers.host || `${host}:${port}`}`);
    if (url.pathname.startsWith("/sprint/assets/") || url.pathname === "/sprint/favicon.svg") {
      const asset = await assets.fetch(new Request(url));
      response.writeHead(asset.status, Object.fromEntries(asset.headers));
      if (request.method === "HEAD" || !asset.body) {
        response.end();
        return;
      }
      Readable.fromWeb(asset.body).pipe(response);
      return;
    }
    const body = request.method === "GET" || request.method === "HEAD" ? undefined : Readable.toWeb(request);
    const result = await handler.fetch(new Request(url, { method: request.method, headers: request.headers, body, duplex: body ? "half" : undefined }), { ASSETS: assets });
    response.writeHead(result.status, Object.fromEntries(result.headers));
    if (request.method === "HEAD" || !result.body) {
      response.end();
      return;
    }
    Readable.fromWeb(result.body).pipe(response);
  } catch (error) {
    console.error(error);
    response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    response.end("Internal Server Error");
  }
});

server.listen(port, host, () => console.log(`Sprint calendar listening on http://${host}:${port}`));
