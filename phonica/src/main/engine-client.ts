// Main-process side of the engine utility process: request/response RPC with
// progress events, restart on crash.
import { utilityProcess, type UtilityProcess } from 'electron';
import { join } from 'node:path';
import { MODEL_FILES, resourcePaths } from './paths.ts';

type Pending = { resolve: (v: any) => void; reject: (e: Error) => void; progress?: (p: { stage: string; frac: number }) => void };

export class EngineClient {
  private proc: UtilityProcess | null = null;
  private seq = 1;
  private pending = new Map<number, Pending>();
  private ready: Promise<any> | null = null;
  status: { ready: boolean; error: string | null; info: any } = { ready: false, error: null, info: null };
  onStatus: ((s: EngineClient['status']) => void) | null = null;

  constructor(private appVersion: string) {}

  start(): Promise<any> {
    if (this.ready) return this.ready;
    const entry = join(__dirname, 'engine.mjs');
    // ONNX Runtime ships a usage-telemetry client; Phonica keeps everything local, so opt out
    this.proc = utilityProcess.fork(entry, [], { serviceName: 'Phonica Speech Engine', stdio: 'pipe', env: { ...process.env, ORT_DISABLE_TELEMETRY: '1' } });
    this.proc.stdout?.on('data', (d) => process.stdout.write(`[engine] ${d}`));
    this.proc.stderr?.on('data', (d) => process.stderr.write(`[engine] ${d}`));
    this.proc.on('message', (m: any) => {
      const p = this.pending.get(m.id);
      if (!p) return;
      if (m.progress) {
        p.progress?.(m.progress);
        return;
      }
      this.pending.delete(m.id);
      if (m.ok) p.resolve(m.result);
      else {
        const err = new Error(m.error?.message ?? 'engine error') as Error & { code?: string };
        err.code = m.error?.code;
        p.reject(err);
      }
    });
    this.proc.on('exit', (code) => {
      for (const p of this.pending.values()) p.reject(new Error(`评测引擎进程意外退出（代码 ${code}）`));
      this.pending.clear();
      this.proc = null;
      this.ready = null;
      this.status = { ready: false, error: `engine exited (${code})`, info: null };
      this.onStatus?.(this.status);
    });
    const r = resourcePaths();
    this.ready = this.call('init', {
      models: r.models,
      lexicon: r.lexicon,
      tts: r.tts,
      scoring: r.scoring,
      aligner: MODEL_FILES.aligner,
      verifier: MODEL_FILES.verifier,
      ttsModel: MODEL_FILES.tts,
      appVersion: this.appVersion,
    }).then(
      (info) => {
        this.status = { ready: true, error: null, info };
        this.onStatus?.(this.status);
        return info;
      },
      (e) => {
        this.status = { ready: false, error: (e as Error).message, info: null };
        this.onStatus?.(this.status);
        throw e;
      },
    );
    return this.ready;
  }

  private call<T = any>(type: string, payload: unknown, transfer: ArrayBuffer[] = [], progress?: Pending['progress']): Promise<T> {
    if (!this.proc) throw new Error('engine not running');
    const id = this.seq++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve, reject, progress });
      // utility-process messages are structured-cloned (transfer lists only carry MessagePorts)
      void transfer;
      this.proc!.postMessage({ id, type, payload });
    });
  }

  async request<T = any>(type: string, payload: unknown, transfer: ArrayBuffer[] = [], progress?: Pending['progress']): Promise<T> {
    await this.start();
    return this.call<T>(type, payload, transfer, progress);
  }

  stop() {
    this.proc?.kill();
  }
}
