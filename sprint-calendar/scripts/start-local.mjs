import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const helper = spawn(process.execPath, [path.join(root, "scripts", "local-resource-server.mjs")], {
  cwd: root,
  stdio: "inherit",
  windowsHide: true,
});
const vinext = spawn(
  process.env.ComSpec || "cmd.exe",
  ["/d", "/c", "call", path.join(root, "node_modules", ".bin", "vinext.cmd"), "dev"],
  {
    cwd: root,
    stdio: ["inherit", "pipe", "pipe"],
    windowsHide: true,
    env: {
      ...process.env,
      WRANGLER_LOG_PATH: path.join(root, ".wrangler", "wrangler.log"),
    },
  },
);

let pageOpened = false;
let vinextOutputBuffer = "";
function relayAndOpen(chunk, destination) {
  destination.write(chunk);
  const plainText = chunk.toString().replace(/\x1b\[[0-9;]*m/g, "");
  vinextOutputBuffer = `${vinextOutputBuffer}${plainText}`.slice(-4096);
  const localUrl = vinextOutputBuffer.match(/http:\/\/localhost:\d+\/?/)?.[0];
  if (pageOpened || !localUrl) return;
  pageOpened = true;
  const opener = spawn(
    process.env.ComSpec || "cmd.exe",
    ["/d", "/s", "/c", "start", '""', localUrl],
    { cwd: root, detached: true, stdio: "ignore", windowsHide: true },
  );
  opener.unref();
}

vinext.stdout.on("data", (chunk) => relayAndOpen(chunk, process.stdout));
vinext.stderr.on("data", (chunk) => relayAndOpen(chunk, process.stderr));

let stopping = false;
function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  if (!helper.killed) helper.kill();
  if (!vinext.killed) vinext.kill();
  setTimeout(() => process.exit(exitCode), 50);
}

helper.on("exit", (code) => {
  if (!stopping && code) console.error(`本地资料助手已退出（${code}），网页仍可复制资料路径。`);
});
vinext.on("exit", (code) => stop(code ?? 0));
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
