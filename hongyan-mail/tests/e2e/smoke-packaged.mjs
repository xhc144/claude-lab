// Smoke test of a packaged build (used by the Windows workflow): starts the real executable with an
// empty data folder, waits for the welcome screen, checks the app reports the packaged version and
// saves a screenshot, then quits cleanly. The updater stays on: an installed copy initialises it
// (its first check comes later than this test), an unpacked one switches it off by itself.
//
//   node tests/e2e/smoke-packaged.mjs "<path to Hongyan Mail.exe>" <screenshot.png>
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron } from 'playwright-core';

const [exe, shot] = process.argv.slice(2);
if (!exe || !fs.existsSync(exe)) throw new Error(`executable not found: ${exe}`);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'hy-smoke-'));

const app = await electron.launch({
  executablePath: exe,
  args: ['--lang=zh-CN'],
  env: { ...process.env, HY_USER_DATA: userData },
  timeout: 60_000
});
const errors = [];
try {
  const win = await app.firstWindow({ timeout: 60_000 });
  win.on('pageerror', (e) => errors.push(e.message));
  await win.waitForSelector('.welcome', { timeout: 30_000 });
  const reported = await app.evaluate(({ app: a }) => ({ version: a.getVersion(), packaged: a.isPackaged }));
  console.log('app reports', reported);
  if (!reported.packaged) throw new Error('not running as a packaged app');
  if (reported.version !== version) throw new Error(`app reports ${reported.version}, package.json says ${version}`);
  if (shot) { fs.mkdirSync(path.dirname(shot), { recursive: true }); await win.screenshot({ path: shot }); }
  if (errors.length) throw new Error(`renderer errors: ${errors.join(' | ')}`);
  const log = path.join(userData, 'logs');
  const lines = fs.existsSync(log) ? fs.readdirSync(log).map((f) => fs.readFileSync(path.join(log, f), 'utf8')).join('').split('\n').filter((l) => /auto-update|updater/.test(l)) : [];
  console.log(lines.length ? lines.join('\n') : 'updater: initialised (nothing logged yet)');
  console.log('smoke test passed: welcome screen shown');
} finally {
  await app.close().catch(() => {});
  fs.rmSync(userData, { recursive: true, force: true });
}
