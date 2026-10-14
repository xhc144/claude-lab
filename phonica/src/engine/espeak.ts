// Loads the espeak-ng WebAssembly phonemiser. Its Emscripten glue installs
// process-wide 'uncaughtException' / 'unhandledRejection' handlers that rethrow
// every error; we remove them again so they cannot take down the host process.
export type Phonemize = (text: string, lang: string) => Promise<string[]>;

let cached: Promise<Phonemize> | null = null;

export function loadPhonemizer(): Promise<Phonemize> {
  if (!cached) {
    cached = (async () => {
      const before = {
        ex: new Set(process.listeners('uncaughtException')),
        rej: new Set(process.listeners('unhandledRejection')),
      };
      const mod = await import('phonemizer');
      for (const l of process.listeners('uncaughtException')) if (!before.ex.has(l)) process.removeListener('uncaughtException', l);
      for (const l of process.listeners('unhandledRejection')) if (!before.rej.has(l)) process.removeListener('unhandledRejection', l);
      return mod.phonemize as Phonemize;
    })();
  }
  return cached;
}
