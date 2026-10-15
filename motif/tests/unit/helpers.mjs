// Shared test helpers: an isolated library/config per test file.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const inputs = path.join(root, 'examples/inputs');

export function tempLibrary(name = 'lib') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `motif-test-${name}-`));
  process.env.MOTIF_HOME = path.join(dir, 'library');
  process.env.MOTIF_USER_DATA = path.join(dir, 'userdata');
  return { dir, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

/** Deterministic text measurer: CJK = 1em, ASCII = 0.55em, em taken from the current font size. */
export function fakeCtx() {
  const ctx = { font: '20px x', measureText: (t) => ({ width: [...t].reduce((s, c) => s + (/[\x00-\x7f]/.test(c) ? 0.55 : 1), 0) * (parseFloat(/([\d.]+)px/.exec(ctx.font)?.[1]) || 20) }) };
  return ctx;
}
