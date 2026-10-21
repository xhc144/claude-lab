// A small pool of Web Workers built from self-contained functions (their source text is shipped to
// the workers, so this works in the single-file build as well). Without Worker support the same
// functions run on the main thread in small time slices.
//
//   const pool = createPool([fnA, fnB, entry], 'entry');
//   pool.broadcast({ ref })                    shared data for later jobs (sent once per worker)
//   pool.run(jobs, (job, result) => …, done)   returns a cancel function; stale results are dropped
//   pool.destroy()

export function createPool(fns, entry, size = Math.min(8, Math.max(2, (navigator.hardwareConcurrency || 4) - 1))) {
  const src = `${fns.map(String).join('\n')}
let SHARED = {};
self.onmessage = (e) => {
  const m = e.data;
  if (m.shared) { SHARED = m.shared; return; }
  const out = ${entry}(Object.assign({}, SHARED, m.job));
  self.postMessage({ id: m.id, out }, [out.buffer]);
};`;
  const workers = [];
  let url = null;
  try {
    url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
    for (let k = 0; k < size; k++) workers.push(new Worker(url));
  } catch {
    workers.length = 0;
  }
  const fallback = workers.length === 0;
  const local = fallback ? new Function(`${fns.map(String).join('\n')}\nreturn ${entry};`)() : null;
  let shared = {};
  let gen = 0;
  let nextId = 1;

  function broadcast(data) {
    shared = data;
    for (const w of workers) w.postMessage({ shared: data });
  }

  function run(jobs, onResult, onDone) {
    const myGen = ++gen;
    const queue = jobs.slice();
    let pending = 0;
    let cancelled = false;
    const finish = () => { if (!cancelled && myGen === gen && queue.length === 0 && pending === 0) onDone?.(); };
    if (fallback) {
      const step = () => {
        if (cancelled || myGen !== gen) return;
        const t0 = performance.now();
        while (queue.length && performance.now() - t0 < 12) {
          const job = queue.shift();
          onResult(job, local({ ...shared, ...job }));
        }
        if (queue.length) setTimeout(step, 0); else finish();
      };
      setTimeout(step, 0);
    } else {
      const feed = (w) => {
        if (cancelled || myGen !== gen || !queue.length) return;
        const job = queue.shift();
        const id = nextId++;
        pending++;
        w.onmessage = (e) => {
          if (e.data.id !== id) return; // the answer to a job of an abandoned run
          pending--;
          if (cancelled || myGen !== gen) return;
          onResult(job, e.data.out);
          feed(w);
          finish();
        };
        w.postMessage({ id, job });
      };
      workers.forEach(feed);
      if (!jobs.length) finish();
    }
    return () => { cancelled = true; };
  }

  function destroy() {
    gen++;
    for (const w of workers) w.terminate();
    if (url) URL.revokeObjectURL(url);
  }

  return { run, broadcast, destroy, size: fallback ? 1 : workers.length, threaded: !fallback };
}
