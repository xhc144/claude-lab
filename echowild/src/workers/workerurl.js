// Creates a generator/mesher worker. The single-file build replaces this module with one that
// starts the worker from an inlined Blob (module workers cannot load from file://).
export function createWorker() {
  return new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
}
