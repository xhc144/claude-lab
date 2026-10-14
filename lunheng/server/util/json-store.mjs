// Small durable JSON persistence: atomic replace on write, serialized writes per file.
import { promises as fs } from 'node:fs';
import { dirname } from 'node:path';
import { randomBytes } from 'node:crypto';

const queues = new Map();

function enqueue(file, task) {
  const prev = queues.get(file) || Promise.resolve();
  const next = prev.catch(() => {}).then(task);
  queues.set(file, next);
  next.finally(() => { if (queues.get(file) === next) queues.delete(file); });
  return next;
}

export async function readJson(file, fallback = null) {
  try {
    const raw = await fs.readFile(file, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    throw err;
  }
}

export function writeJson(file, value, { mode = 0o600 } = {}) {
  return enqueue(file, async () => {
    await fs.mkdir(dirname(file), { recursive: true, mode: 0o700 });
    const tmp = `${file}.${randomBytes(4).toString('hex')}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(value, null, 1), { mode });
    await fs.rename(tmp, file);
  });
}

export function appendLine(file, value) {
  return enqueue(file, async () => {
    await fs.mkdir(dirname(file), { recursive: true, mode: 0o700 });
    await fs.appendFile(file, JSON.stringify(value) + '\n', { mode: 0o600 });
  });
}

export async function removePath(path) {
  await fs.rm(path, { recursive: true, force: true });
}

/** Wait until every pending write has landed (used on shutdown and in tests). */
export async function flushWrites() {
  while (queues.size) await Promise.allSettled([...queues.values()]);
}
