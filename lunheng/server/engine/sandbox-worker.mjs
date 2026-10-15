// Runs untrusted model-written JavaScript inside QuickJS compiled to WebAssembly. The guest has
// no access to Node APIs, the filesystem or the network; only console.log/print are provided.
import { parentPort, workerData } from 'node:worker_threads';
import { getQuickJS, shouldInterruptAfterDeadline } from 'quickjs-emscripten';

const { code, timeoutMs, memoryMb, maxOutput } = workerData;
const started = Date.now();
let output = '';
let truncated = false;
const write = (s) => {
  if (output.length >= maxOutput) { truncated = true; return; }
  output += s;
  if (output.length > maxOutput) { output = output.slice(0, maxOutput); truncated = true; }
};

// Formatting runs inside the guest so BigInt, Map, Set and nested values print like a REPL.
const PRELUDE = `(function(){
  const out = globalThis.__out; delete globalThis.__out;
  function fmt(v, depth, seen) {
    depth = depth || 0; seen = seen || new Set();
    if (typeof v === 'string') return depth ? JSON.stringify(v) : v;
    if (typeof v === 'bigint') return v + 'n';
    if (typeof v === 'number' || typeof v === 'boolean' || v == null) return String(v);
    if (typeof v === 'function') return '[Function ' + (v.name || 'anonymous') + ']';
    if (typeof v === 'symbol') return v.toString();
    if (seen.has(v)) return '[Circular]';
    if (depth > 4) return Array.isArray(v) ? '[Array]' : '[Object]';
    seen.add(v);
    let s;
    if (Array.isArray(v)) {
      const items = v.slice(0, 200).map(function (x) { return fmt(x, depth + 1, seen); });
      if (v.length > 200) items.push('… ' + (v.length - 200) + ' more');
      s = '[' + items.join(', ') + ']';
    } else if (v instanceof Map) {
      s = 'Map(' + v.size + ') {' + Array.from(v).slice(0, 50).map(function (e) { return fmt(e[0], depth + 1, seen) + ' => ' + fmt(e[1], depth + 1, seen); }).join(', ') + '}';
    } else if (v instanceof Set) {
      s = 'Set(' + v.size + ') {' + Array.from(v).slice(0, 50).map(function (x) { return fmt(x, depth + 1, seen); }).join(', ') + '}';
    } else if (v instanceof Error) {
      s = v.name + ': ' + v.message;
    } else {
      const keys = Object.keys(v);
      s = '{' + keys.slice(0, 50).map(function (k) { return k + ': ' + fmt(v[k], depth + 1, seen); }).join(', ') + (keys.length > 50 ? ', …' : '') + '}';
    }
    seen.delete(v);
    return s;
  }
  const log = function () { out(Array.prototype.map.call(arguments, function (x) { return fmt(x); }).join(' ') + '\\n'); };
  globalThis.console = { log: log, info: log, warn: log, error: log, debug: log };
  globalThis.print = log;
  Object.defineProperty(globalThis, '__fmt', { value: fmt, enumerable: false });
})();`;

try {
  const QuickJS = await getQuickJS();
  const runtime = QuickJS.newRuntime();
  runtime.setMemoryLimit(memoryMb * 1024 * 1024);
  runtime.setMaxStackSize(1024 * 1024);
  runtime.setInterruptHandler(shouldInterruptAfterDeadline(Date.now() + timeoutMs));
  const vm = runtime.newContext();
  const outFn = vm.newFunction('__out', (h) => { write(vm.getString(h)); });
  vm.setProp(vm.global, '__out', outFn);
  outFn.dispose();
  vm.unwrapResult(vm.evalCode(PRELUDE, 'prelude.js')).dispose();

  const result = vm.evalCode(code, 'compute.js');
  let error = '';
  if (result.error) {
    const e = vm.dump(result.error);
    error = typeof e === 'object' && e ? `${e.name || 'Error'}: ${e.message || ''}`.trim() : String(e);
    if (/interrupted/i.test(error)) error = `超时：运行超过 ${timeoutMs} ms 被中止`;
    result.error.dispose();
  } else {
    if (!output && vm.typeof(result.value) !== 'undefined') {
      const fmt = vm.getProp(vm.global, '__fmt');
      const shown = vm.callFunction(fmt, vm.undefined, result.value);
      if (!shown.error) { write(vm.getString(shown.value)); shown.value.dispose(); } else shown.error.dispose();
      fmt.dispose();
    }
    result.value.dispose();
  }
  vm.dispose();
  runtime.dispose();
  parentPort.postMessage({ ok: !error, output, error, truncated, durationMs: Date.now() - started });
} catch (err) {
  parentPort.postMessage({ ok: false, output, error: String(err?.message || err), truncated, durationMs: Date.now() - started });
}
