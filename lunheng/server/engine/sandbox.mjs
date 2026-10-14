import { Worker } from 'node:worker_threads';
import { Semaphore } from '../util/semaphore.mjs';

const WORKER = new URL('./sandbox-worker.mjs', import.meta.url);
// Guest code can allocate inside WebAssembly memory outside V8's heap limits; cap parallel runs.
const slots = new Semaphore(2);

/** Execute code in an isolated QuickJS worker. Never throws; failures are reported in the result. */
export async function runCompute(code, opts = {}) {
  const release = await slots.acquire();
  try {
    return await runOnce(code, opts);
  } finally {
    release();
  }
}

function runOnce(code, { timeoutMs = 4000, memoryMb = 64, maxOutput = 16000 } = {}) {
  return new Promise((resolve) => {
    const started = Date.now();
    let settled = false;
    const done = (r) => { if (!settled) { settled = true; clearTimeout(timer); resolve(r); } };
    const worker = new Worker(WORKER, {
      workerData: { code: String(code).slice(0, 50_000), timeoutMs, memoryMb, maxOutput },
      resourceLimits: { maxOldGenerationSizeMb: 256, maxYoungGenerationSizeMb: 64 },
    });
    // Backstop in case the interpreter is stuck outside the interrupt handler.
    const timer = setTimeout(() => {
      worker.terminate();
      done({ ok: false, output: '', error: `超时：超过 ${timeoutMs} ms`, truncated: false, durationMs: Date.now() - started });
    }, timeoutMs + 1500);
    worker.once('message', (m) => { done(m); worker.terminate(); });
    worker.once('error', (e) => done({ ok: false, output: '', error: String(e?.message || e), truncated: false, durationMs: Date.now() - started }));
    worker.once('exit', (c) => done({ ok: false, output: '', error: `沙箱异常退出 (${c})`, truncated: false, durationMs: Date.now() - started }));
  });
}
