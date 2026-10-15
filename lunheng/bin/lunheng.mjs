#!/usr/bin/env node
// Launcher: when an HTTP(S) proxy is configured in the environment, restart Node with
// NODE_USE_ENV_PROXY=1 so that the built-in fetch honours HTTPS_PROXY / NO_PROXY (Node ≥ 22.21 / 24).
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const entry = fileURLToPath(new URL('../server/index.mjs', import.meta.url));
const proxy = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy;

if (proxy && !process.env.NODE_USE_ENV_PROXY) {
  const child = spawn(process.execPath, [entry, ...process.argv.slice(2)], {
    stdio: 'inherit',
    env: { ...process.env, NODE_USE_ENV_PROXY: '1', NODE_NO_WARNINGS: process.env.NODE_NO_WARNINGS ?? '1' },
  });
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));
  child.on('exit', (code, signal) => process.exit(signal ? 1 : code ?? 0));
} else {
  await import(entry);
}
