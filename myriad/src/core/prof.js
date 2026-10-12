// Tiny always-on profiler: exponential moving averages of how long each subsystem takes,
// shown in the debug overlay and used by the headless benchmarks.

export function prof(w, key, t0) {
  const p = w._prof || (w._prof = {});
  const dt = performance.now() - t0;
  p[key] = p[key] === undefined ? dt : p[key] * 0.9 + dt * 0.1;
  return performance.now();
}

export const now = () => performance.now();
