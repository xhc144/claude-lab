// Safe math expression compiler. No eval: parses to an AST and compiles to closures.
// Supports + - * / ^ (and **), unary minus, implicit multiplication (2x, 2pi, 3(x+1), (x+1)(x-1)),
// functions, constants pi/e/tau, and free variables (x, y, t, and user parameters).

const FUNCS = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan, atan2: Math.atan2,
  sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh, arcsin: Math.asin, arccos: Math.acos, arctan: Math.atan,
  exp: Math.exp, log: Math.log, ln: Math.log, log10: Math.log10, log2: Math.log2, sqrt: Math.sqrt, cbrt: Math.cbrt,
  abs: Math.abs, floor: Math.floor, ceil: Math.ceil, round: Math.round, sign: Math.sign, min: Math.min, max: Math.max,
  pow: Math.pow, hypot: Math.hypot, mod: (a, b) => ((a % b) + b) % b, sec: (x) => 1 / Math.cos(x), csc: (x) => 1 / Math.sin(x), cot: (x) => 1 / Math.tan(x),
  step: (x) => (x >= 0 ? 1 : 0), clamp: (x, a, b) => Math.min(b, Math.max(a, x)), sigmoid: (x) => 1 / (1 + Math.exp(-x)),
  gauss: (x, m = 0, s = 1) => Math.exp(-((x - m) ** 2) / (2 * s * s)) / (s * Math.sqrt(2 * Math.PI)),
  fact: (n) => { let r = 1; for (let i = 2; i <= Math.round(n); i++) r *= i; return r; },
};
const CONSTS = { pi: Math.PI, π: Math.PI, e: Math.E, tau: 2 * Math.PI, phi: (1 + Math.sqrt(5)) / 2 };

function tokenize(src) {
  const s = String(src).replace(/\*\*/g, '^').replace(/[×·]/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/\\cdot/g, '*').replace(/\\pi/g, 'pi').replace(/\\left|\\right/g, '').replace(/\{/g, '(').replace(/\}/g, ')').replace(/\\(sin|cos|tan|exp|ln|log|sqrt)/g, '$1');
  const toks = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (/[\d.]/.test(ch)) {
      const m = /^(\d*\.?\d+(?:[eE][-+]?\d+)?|\d+\.)/.exec(s.slice(i));
      toks.push({ t: 'num', v: parseFloat(m[0]) }); i += m[0].length; continue;
    }
    if (/[A-Za-zα-ωπθ_]/.test(ch)) {
      const m = /^[A-Za-zα-ωπθ_][A-Za-z0-9_α-ωπθ]*/.exec(s.slice(i));
      let name = m[0];
      i += name.length;
      // split implicit products of known names: "xsin" -> x * sin, "pix" -> pi * x
      if (!FUNCS[name] && !CONSTS[name] && name.length > 1 && !/^[a-z]\d+$/i.test(name)) {
        const parts = splitName(name);
        parts.forEach((p, k) => { if (k) toks.push({ t: 'op', v: '*' }); toks.push({ t: 'id', v: p }); });
        continue;
      }
      toks.push({ t: 'id', v: name }); continue;
    }
    if ('+-*/^(),'.includes(ch)) { toks.push({ t: ch === '(' || ch === ')' || ch === ',' ? ch : 'op', v: ch }); i++; continue; }
    if (ch === '[') { toks.push({ t: '(', v: '(' }); i++; continue; }
    if (ch === ']') { toks.push({ t: ')', v: ')' }); i++; continue; }
    if (ch === '|') { toks.push({ t: '|', v: '|' }); i++; continue; }
    throw new Error(`表达式中有无法识别的字符 "${ch}"`);
  }
  // insert implicit multiplication
  const out = [];
  for (let k = 0; k < toks.length; k++) {
    const a = out[out.length - 1], b = toks[k];
    if (a && (a.t === 'num' || a.t === ')' || (a.t === 'id' && !FUNCS[a.v])) && (b.t === 'num' || b.t === '(' || b.t === 'id')) {
      if (!(a.t === 'id' && b.t === '(' && FUNCS[a.v])) out.push({ t: 'op', v: '*' });
    }
    out.push(b);
  }
  return out;
}

function splitName(name) {
  const known = [...Object.keys(FUNCS), ...Object.keys(CONSTS)].sort((a, b) => b.length - a.length);
  const out = [];
  let rest = name;
  while (rest.length) {
    const k = known.find((n) => rest.startsWith(n));
    if (k) { out.push(k); rest = rest.slice(k.length); }
    else { out.push(rest[0]); rest = rest.slice(1); }
  }
  return out;
}

function parse(toks) {
  let i = 0;
  const peek = () => toks[i];
  const eat = (t, v) => { const k = toks[i]; if (!k || k.t !== t || (v && k.v !== v)) throw new Error(`表达式语法错误：期望 ${v || t}`); i++; return k; };
  function expr() { let n = term(); while (peek() && peek().t === 'op' && (peek().v === '+' || peek().v === '-')) { const op = toks[i++].v; n = { op, a: n, b: term() }; } return n; }
  function term() { let n = unary(); while (peek() && peek().t === 'op' && (peek().v === '*' || peek().v === '/')) { const op = toks[i++].v; n = { op, a: n, b: unary() }; } return n; }
  function unary() { if (peek() && peek().t === 'op' && (peek().v === '-' || peek().v === '+')) { const op = toks[i++].v; const a = unary(); return op === '-' ? { op: 'neg', a } : a; } return power(); }
  function power() { const base = atom(); if (peek() && peek().t === 'op' && peek().v === '^') { i++; return { op: '^', a: base, b: unary() }; } return base; }
  function atom() {
    const k = peek();
    if (!k) throw new Error('表达式不完整');
    if (k.t === 'num') { i++; return { num: k.v }; }
    if (k.t === '(') { i++; const n = expr(); eat(')'); return n; }
    if (k.t === '|') { i++; const n = expr(); eat('|'); return { fn: 'abs', args: [n] }; }
    if (k.t === 'id') {
      i++;
      if (FUNCS[k.v] && peek() && peek().t === '(') {
        i++;
        const args = [];
        if (peek() && peek().t !== ')') { args.push(expr()); while (peek() && peek().t === ',') { i++; args.push(expr()); } }
        eat(')');
        return { fn: k.v, args };
      }
      if (FUNCS[k.v]) { const a = power(); return { fn: k.v, args: [a] }; } // sin x
      return { id: k.v };
    }
    throw new Error(`表达式语法错误：意外的 "${k.v}"`);
  }
  const n = expr();
  if (i < toks.length) throw new Error(`表达式语法错误：多余的 "${toks[i].v}"`);
  return n;
}

function build(n) {
  if ('num' in n) { const v = n.num; return () => v; }
  if (n.id) {
    const name = n.id;
    if (name in CONSTS) { const v = CONSTS[name]; return (s) => (name in s ? s[name] : v); }
    return (s) => s[name] ?? 0;
  }
  if (n.fn) {
    const f = FUNCS[n.fn];
    const as = n.args.map(build);
    if (as.length === 1) { const a = as[0]; return (s) => f(a(s)); }
    return (s) => f(...as.map((a) => a(s)));
  }
  const a = build(n.a);
  if (n.op === 'neg') return (s) => -a(s);
  const b = build(n.b);
  switch (n.op) {
    case '+': return (s) => a(s) + b(s);
    case '-': return (s) => a(s) - b(s);
    case '*': return (s) => a(s) * b(s);
    case '/': return (s) => a(s) / b(s);
    case '^': return (s) => a(s) ** b(s);
    default: throw new Error('unknown op ' + n.op);
  }
}

function vars(n, set = new Set()) {
  if (n.id && !(n.id in CONSTS)) set.add(n.id);
  if (n.args) n.args.forEach((a) => vars(a, set));
  if (n.a) vars(n.a, set);
  if (n.b) vars(n.b, set);
  return set;
}

const cache = new Map();
/** compile("sin(x)*a") → { fn(scope) → number, vars: Set } ; throws with a readable message. */
export function compileExpr(src) {
  const key = String(src);
  let c = cache.get(key);
  if (!c) {
    const ast = parse(tokenize(key));
    c = { fn: build(ast), vars: vars(ast), src: key };
    if (cache.size > 2000) cache.clear();
    cache.set(key, c);
  }
  return c;
}

/** Validate without throwing: returns null or an error message. */
export function checkExpr(src) {
  try { compileExpr(src); return null; } catch (e) { return e.message; }
}

/** Convenience: f(x) evaluator with extra scope. */
export function fx(src, scope = {}) {
  const { fn } = compileExpr(src);
  const s = { ...scope, x: 0 };
  return (x) => { s.x = x; return fn(s); };
}

export const EXPR_FUNCTIONS = Object.keys(FUNCS);
