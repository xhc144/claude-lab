import { createServer } from "node:http";
import { stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_PORT = 43127;
const LOCAL_ORIGIN = /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i;

export function normalizeLocalPath(value) {
  if (typeof value !== "string") return null;
  const candidate = value.trim();
  if (!candidate || candidate.length > 2048 || /[\0\r\n]/.test(candidate)) return null;
  if (!/^(?:[a-z]:\\|\\\\[^\\]+\\[^\\]+)/i.test(candidate)) return null;
  const normalized = path.win32.normalize(candidate);
  if (/^[a-z]:\\?$/i.test(normalized)) return null;
  return normalized;
}

function send(response, status, body, origin = "") {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(body));
}

export function createResourceServer({ openPath } = {}) {
  const launch = openPath ?? ((target) => {
    const child = spawn("explorer.exe", [target], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
      shell: false,
    });
    child.unref();
  });

  return createServer(async (request, response) => {
    const origin = request.headers.origin ?? "";
    if (origin && !LOCAL_ORIGIN.test(origin)) {
      send(response, 403, { ok: false, error: "origin_not_allowed" });
      return;
    }
    if (request.method === "OPTIONS") {
      send(response, 204, {}, origin);
      return;
    }
    if (request.method === "GET" && request.url === "/health") {
      send(response, 200, { ok: true }, origin);
      return;
    }
    if (request.method !== "POST" || request.url !== "/open") {
      send(response, 404, { ok: false, error: "not_found" }, origin);
      return;
    }

    let raw = "";
    for await (const chunk of request) {
      raw += chunk;
      if (raw.length > 4096) {
        send(response, 413, { ok: false, error: "payload_too_large" }, origin);
        return;
      }
    }

    try {
      const target = normalizeLocalPath(JSON.parse(raw).path);
      if (!target) {
        send(response, 400, { ok: false, error: "invalid_path" }, origin);
        return;
      }
      await stat(target);
      launch(target);
      send(response, 200, { ok: true, path: target }, origin);
    } catch (error) {
      const missing = error && typeof error === "object" && "code" in error && error.code === "ENOENT";
      send(response, missing ? 404 : 500, { ok: false, error: missing ? "path_not_found" : "open_failed" }, origin);
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.SPRINT_RESOURCE_PORT || DEFAULT_PORT);
  createResourceServer().listen(port, "127.0.0.1", () => {
    console.log(`本地资料助手已就绪：http://127.0.0.1:${port}`);
  });
}

