// Typed client for the main-process API exposed by the preload bridge.
import type { MailApi } from '@shared/api';
import type { AppEvent, Diagnosis } from '@shared/types';

interface RawBridge {
  invoke(method: string, ...args: unknown[]): Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string; code?: string; diagnosis?: Diagnosis | null } }>;
  onEvent(cb: (e: AppEvent) => void): () => void;
  ready(): void;
  platform: string;
  pathForFile(file: File): string;
}

declare global {
  interface Window {
    hy: RawBridge;
  }
}

export class ApiError extends Error {
  code?: string;
  diagnosis: Diagnosis | null;
  constructor(message: string, code?: string, diagnosis?: Diagnosis | null) {
    super(message);
    this.code = code;
    this.diagnosis = diagnosis || null;
  }
}

export const api: MailApi = new Proxy({} as MailApi, {
  get(_t, method: string) {
    return async (...args: unknown[]) => {
      const res = await window.hy.invoke(method, ...args);
      if (res.ok) return res.value;
      throw new ApiError(res.error.message, res.error.code, res.error.diagnosis);
    };
  }
});

export const onEvent = (cb: (e: AppEvent) => void) => window.hy.onEvent(cb);
export const platform = () => window.hy?.platform || 'win32';
export const pathForFile = (f: File) => window.hy.pathForFile(f);

export function errorMessage(e: unknown): { title: string; detail?: string } {
  if (e instanceof ApiError && e.diagnosis) return { title: e.diagnosis.title, detail: e.diagnosis.explanation };
  if (e instanceof Error) return { title: e.message };
  return { title: String(e) };
}
