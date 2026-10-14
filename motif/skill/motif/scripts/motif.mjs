#!/usr/bin/env node
// Locates the Motif CLI on this machine and forwards all arguments to it.
//   node scripts/motif.mjs <command> [args…]
// Search order: $MOTIF_CLI → motif-cli.json (written by the app's "AI 集成 → 安装 Skill")
// → `motif` on PATH → standard install locations → a development checkout.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const skillDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const win = process.platform === 'win32';

function fromEnv() {
  const p = process.env.MOTIF_CLI;
  if (!p || !fs.existsSync(p)) return null;
  return p.endsWith('.mjs') ? { command: process.execPath, args: [p] } : { command: p, args: [] };
}
function fromConfig() {
  const f = path.join(skillDir, 'motif-cli.json');
  if (!fs.existsSync(f)) return null;
  try { const c = JSON.parse(fs.readFileSync(f, 'utf8')); return c.command && (fs.existsSync(c.command) || c.command === 'node') ? c : null; } catch { return null; }
}
function onPath() {
  const r = spawnSync(win ? 'where' : 'which', ['motif'], { encoding: 'utf8' });
  const hit = r.status === 0 && r.stdout.split(/\r?\n/).find(Boolean);
  return hit ? { command: hit.trim(), args: [], shell: win } : null;
}
function installed() {
  const local = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  const cands = win
    ? [path.join(local, 'Programs', 'Motif', 'motif.cmd'), path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Motif', 'motif.cmd')]
    : process.platform === 'darwin' ? ['/Applications/Motif.app/Contents/Resources/motif'] : ['/opt/Motif/motif', path.join(os.homedir(), '.local/share/Motif/motif')];
  const f = cands.find((c) => fs.existsSync(c));
  return f ? { command: f, args: [], shell: win } : null;
}
function devCheckout() {
  for (const up of ['../..', '../../..', '../../../..']) {
    const bin = path.resolve(skillDir, up, 'bin', 'motif.mjs');
    if (fs.existsSync(bin)) return { command: process.execPath, args: [bin] };
  }
  return null;
}

const cli = fromEnv() || fromConfig() || onPath() || installed() || devCheckout();
if (!cli) {
  console.error('找不到 Motif。请先安装 Motif 桌面应用，并在 设置 → AI 集成 中点击「安装 Skill」；或设置环境变量 MOTIF_CLI 指向 motif 可执行文件。');
  process.exit(127);
}
const command = cli.command === 'node' ? process.execPath : cli.command;
const child = spawn(command, [...(cli.args || []), ...process.argv.slice(2)], { stdio: 'inherit', env: { ...process.env, ...(cli.env || {}) }, shell: !!cli.shell });
child.on('exit', (code, sig) => process.exit(sig ? 1 : code ?? 1));
child.on('error', (e) => { console.error(`无法启动 Motif CLI：${e.message}`); process.exit(127); });
