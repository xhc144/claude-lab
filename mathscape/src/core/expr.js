// Expression language shared by the complex-map and ODE modules.
//
//   parse(src, ctx)          -> AST            (throws ExprError with a source position)
//   compileReal(ast, args)   -> (…args) => number
//   compileComplex(ast)      -> (zr, zi, ar, ai, out) => void   (writes Re/Im into out[0], out[1])
//
// Grammar (lowest to highest precedence):
//   sum     := product (('+' | '-') product)*
//   product := unary (('*' | '/') unary | <implicit> power)*
//   unary   := ('-' | '+') unary | power
//   power   := primary ('^' unary)?          right-associative, so -x^2 = -(x^2), 2^-1 = 0.5
//   primary := number | name | name '(' args ')' | '(' sum ')' | '|' sum '|'
// Implicit multiplication is triggered by a following name or '(' : 2x, 3(x+1), x sin(y), (a)(b).
// An unknown multi-letter name made only of known single-letter symbols is split: xy -> x*y.

import { H } from './complex.js';

export class ExprError extends Error {
  constructor(message, pos = 0, len = 1) {
    super(message);
    this.name = 'ExprError';
    this.pos = pos;
    this.len = len;
  }
}

// ---------------------------------------------------------------------------------------------
// Function tables. `arity` is [min, max].

export const REAL_FUNCS = {
  sin: [1, 1], cos: [1, 1], tan: [1, 1], sec: [1, 1], csc: [1, 1], cot: [1, 1],
  asin: [1, 1], acos: [1, 1], atan: [1, 2], atan2: [2, 2],
  sinh: [1, 1], cosh: [1, 1], tanh: [1, 1], asinh: [1, 1], acosh: [1, 1], atanh: [1, 1],
  exp: [1, 1], log: [1, 1], ln: [1, 1], log10: [1, 1], log2: [1, 1],
  sqrt: [1, 1], cbrt: [1, 1], abs: [1, 1], sign: [1, 1],
  floor: [1, 1], ceil: [1, 1], round: [1, 1], mod: [2, 2],
  min: [2, 2], max: [2, 2], pow: [2, 2], hypot: [2, 2],
};

export const COMPLEX_FUNCS = {
  sin: [1, 1], cos: [1, 1], tan: [1, 1], sec: [1, 1], csc: [1, 1], cot: [1, 1],
  asin: [1, 1], acos: [1, 1], atan: [1, 1],
  sinh: [1, 1], cosh: [1, 1], tanh: [1, 1],
  exp: [1, 1], log: [1, 1], ln: [1, 1], sqrt: [1, 1], pow: [2, 2],
  abs: [1, 1], arg: [1, 1], re: [1, 1], im: [1, 1], conj: [1, 1], gamma: [1, 1],
};

export const REAL_CONSTS = { pi: Math.PI, e: Math.E, tau: 2 * Math.PI };
export const COMPLEX_CONSTS = { pi: [Math.PI, 0], e: [Math.E, 0], tau: [2 * Math.PI, 0], i: [0, 1] };

/** Context for real-valued expressions (ODE right-hand sides, matrix entries). */
export function realContext(vars = []) {
  return { mode: 'real', vars: new Set(vars), funcs: REAL_FUNCS, consts: REAL_CONSTS };
}

/** Context for complex expressions f(z); x = Re z, y = Im z, a = draggable complex parameter. */
export function complexContext(vars = ['z', 'x', 'y', 'a']) {
  return { mode: 'complex', vars: new Set(vars), funcs: COMPLEX_FUNCS, consts: COMPLEX_CONSTS };
}

// ---------------------------------------------------------------------------------------------
// Tokenizer

const SINGLE = new Set(['+', '-', '*', '/', '^', '(', ')', ',', '|']);
const ALIASES = { '−': '-', '–': '-', '×': '*', '·': '*', '∙': '*', '÷': '/', '（': '(', '）': ')', '，': ',' };

export function tokenize(src) {
  const toks = [];
  let i = 0;
  while (i < src.length) {
    let ch = src[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (ALIASES[ch]) ch = ALIASES[ch];
    if (/[0-9.]/.test(ch)) {
      const m = /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(src.slice(i));
      if (!m) throw new ExprError('无法识别的数字', i);
      toks.push({ t: 'num', v: parseFloat(m[0]), raw: m[0], pos: i, len: m[0].length });
      i += m[0].length;
      continue;
    }
    if (ch === 'π') { toks.push({ t: 'id', v: 'pi', pos: i, len: 1 }); i++; continue; }
    if (/[A-Za-z_]/.test(ch)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i));
      toks.push({ t: 'id', v: m[0], pos: i, len: m[0].length });
      i += m[0].length;
      continue;
    }
    if (ch === '*' && src[i + 1] === '*') { toks.push({ t: '^', pos: i, len: 2 }); i += 2; continue; }
    if (ch === '²' || ch === '³') {
      toks.push({ t: '^', pos: i, len: 1 });
      toks.push({ t: 'num', v: ch === '²' ? 2 : 3, raw: ch === '²' ? '2' : '3', pos: i, len: 1 });
      i++;
      continue;
    }
    if (SINGLE.has(ch)) { toks.push({ t: ch, pos: i, len: 1 }); i++; continue; }
    throw new ExprError(`无法识别的字符 “${src[i]}”`, i);
  }
  toks.push({ t: 'eof', pos: src.length, len: 0 });
  return toks;
}

// ---------------------------------------------------------------------------------------------
// Parser

// `raw` keeps the literal's source text so the high-precision evaluator can read it exactly
const num = (value, raw = String(value)) => ({ type: 'num', value, raw });
const bin = (op, left, right) => ({ type: 'bin', op, left, right });

class Parser {
  constructor(src, ctx) {
    this.src = src;
    this.ctx = ctx;
    this.toks = tokenize(src);
    this.k = 0;
  }
  peek() { return this.toks[this.k]; }
  next() { return this.toks[this.k++]; }
  fail(msg, tok = this.peek()) { throw new ExprError(msg, tok.pos, Math.max(1, tok.len)); }
  expect(t, msg) {
    const tok = this.peek();
    if (tok.t !== t) this.fail(msg);
    return this.next();
  }

  parse() {
    if (this.peek().t === 'eof') this.fail('表达式为空');
    const node = this.sum();
    const tok = this.peek();
    if (tok.t !== 'eof') this.fail(tok.t === ')' ? '多余的右括号 “)”' : `无法理解 “${this.src.slice(tok.pos, tok.pos + Math.max(1, tok.len))}”`);
    return node;
  }

  sum() {
    let node = this.product();
    while (this.peek().t === '+' || this.peek().t === '-') {
      const op = this.next().t;
      node = bin(op, node, this.product());
    }
    return node;
  }

  product() {
    let node = this.unary();
    for (;;) {
      const t = this.peek().t;
      if (t === '*' || t === '/') {
        this.next();
        node = bin(t, node, this.unary());
      } else if (t === 'id' || t === '(') {
        node = bin('*', node, this.power());
      } else {
        return node;
      }
    }
  }

  unary() {
    const t = this.peek().t;
    if (t === '-') { this.next(); return { type: 'neg', arg: this.unary() }; }
    if (t === '+') { this.next(); return this.unary(); }
    return this.power();
  }

  power() {
    const base = this.primary();
    if (this.peek().t === '^') {
      this.next();
      return bin('^', base, this.unary());
    }
    return base;
  }

  primary() {
    const tok = this.peek();
    switch (tok.t) {
      case 'num':
        this.next();
        return num(tok.v, tok.raw);
      case '(': {
        this.next();
        if (this.peek().t === ')') this.fail('括号内缺少表达式');
        const inner = this.sum();
        this.expect(')', '缺少右括号 “)”');
        return inner;
      }
      case '|': {
        this.next();
        const inner = this.sum();
        this.expect('|', '缺少配对的 “|”');
        return { type: 'call', name: 'abs', args: [inner] };
      }
      case 'id':
        return this.name();
      case 'eof':
        this.fail('表达式不完整');
        break;
      default:
        this.fail(`此处不应出现 “${this.src.slice(tok.pos, tok.pos + tok.len)}”`);
    }
    return null;
  }

  name() {
    const tok = this.next();
    const { funcs, vars, consts } = this.ctx;
    const id = tok.v;
    if (Object.hasOwn(funcs, id)) {
      if (this.peek().t !== '(') this.fail(`函数 ${id} 后面需要括号，例如 ${id}(…)`, tok);
      this.next();
      const args = [];
      if (this.peek().t !== ')') {
        args.push(this.sum());
        while (this.peek().t === ',') { this.next(); args.push(this.sum()); }
      }
      this.expect(')', `函数 ${id} 缺少右括号 “)”`);
      const [lo, hi] = funcs[id];
      if (args.length < lo || args.length > hi) {
        const want = lo === hi ? `${lo} 个` : `${lo}–${hi} 个`;
        throw new ExprError(`函数 ${id} 需要 ${want}参数，实际为 ${args.length} 个`, tok.pos, tok.len);
      }
      return { type: 'call', name: id, args };
    }
    if (vars.has(id)) return { type: 'var', name: id };
    if (Object.hasOwn(consts, id)) return { type: 'const', name: id };
    // xy -> x*y when every letter is a known single-letter symbol
    if (id.length > 1 && [...id].every((c) => vars.has(c) || Object.hasOwn(consts, c))) {
      let node = null;
      for (const c of id) {
        const leaf = vars.has(c) ? { type: 'var', name: c } : { type: 'const', name: c };
        node = node ? bin('*', node, leaf) : leaf;
      }
      return node;
    }
    const known = [...vars].join(', ');
    throw new ExprError(`未知符号 “${id}”${known ? `（可用变量：${known}）` : ''}`, tok.pos, tok.len);
  }
}

export function parse(src, ctx) {
  return new Parser(String(src), ctx).parse();
}

/** Names of the variables an AST refers to. */
export function variablesOf(ast, acc = new Set()) {
  switch (ast.type) {
    case 'var': acc.add(ast.name); break;
    case 'neg': variablesOf(ast.arg, acc); break;
    case 'bin': variablesOf(ast.left, acc); variablesOf(ast.right, acc); break;
    case 'call': for (const a of ast.args) variablesOf(a, acc); break;
    default: break;
  }
  return acc;
}

// ---------------------------------------------------------------------------------------------
// Real code generation

const literal = (v) => (Object.is(v, -0) ? '0' : v < 0 ? `(${v})` : String(v));

const REAL_IMPL = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan,
  sec: (x) => 1 / Math.cos(x), csc: (x) => 1 / Math.sin(x), cot: (x) => 1 / Math.tan(x),
  asin: Math.asin, acos: Math.acos,
  atan: (y, x) => (x === undefined ? Math.atan(y) : Math.atan2(y, x)), atan2: Math.atan2,
  sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh, asinh: Math.asinh, acosh: Math.acosh, atanh: Math.atanh,
  exp: Math.exp, log: Math.log, ln: Math.log, log10: Math.log10, log2: Math.log2,
  sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs, sign: Math.sign,
  floor: Math.floor, ceil: Math.ceil, round: Math.round,
  mod: (a, b) => a - b * Math.floor(a / b),
  min: Math.min, max: Math.max, pow: Math.pow, hypot: Math.hypot,
};

function genReal(node, argIndex) {
  switch (node.type) {
    case 'num': return literal(node.value);
    case 'const': return literal(REAL_CONSTS[node.name]);
    case 'var': {
      if (!argIndex.has(node.name)) throw new ExprError(`变量 ${node.name} 不可用`);
      return `v${argIndex.get(node.name)}`;
    }
    case 'neg': return `(-${genReal(node.arg, argIndex)})`;
    case 'bin': {
      const l = genReal(node.left, argIndex);
      const r = genReal(node.right, argIndex);
      if (node.op === '^') {
        if (node.right.type === 'num' && node.right.value === 2) return `(${l}*${l})`;
        return `Math.pow(${l},${r})`;
      }
      return `(${l}${node.op}${r})`;
    }
    case 'call':
      return `F.${node.name}(${node.args.map((a) => genReal(a, argIndex)).join(',')})`;
    default:
      throw new ExprError('内部错误：未知节点');
  }
}

/** Compile a real AST to a JS function taking the named arguments in order. */
export function compileReal(ast, argNames) {
  const argIndex = new Map(argNames.map((n, k) => [n, k]));
  const body = genReal(ast, argIndex);
  const params = argNames.map((_, k) => `v${k}`).join(',');
  return new Function('F', `"use strict"; return function(${params}){ return ${body}; };`)(REAL_IMPL);
}

/** Parse + compile in one go; the returned function has `.ast` and `.vars` attached. */
export function realFunction(src, argNames) {
  const ast = parse(src, realContext(argNames));
  const fn = compileReal(ast, argNames);
  fn.ast = ast;
  fn.vars = variablesOf(ast);
  return fn;
}

/** Evaluate a constant real expression such as "sqrt(2)/2" or "cos(pi/6)". */
export function evalConstant(src) {
  const ast = parse(src, realContext([]));
  return compileReal(ast, [])();
}

// ---------------------------------------------------------------------------------------------
// Complex code generation: straight-line code on (re, im) float pairs, no allocation per call.

const COMPLEX_HELPER = {
  sin: 'sin', cos: 'cos', tan: 'tan', sec: 'sec', csc: 'csc', cot: 'cot',
  asin: 'asin', acos: 'acos', atan: 'atan', sinh: 'sinh', cosh: 'cosh', tanh: 'tanh',
  exp: 'exp', log: 'log', ln: 'log', sqrt: 'sqrt', gamma: 'gamma',
};

function genComplex(ast) {
  const lines = [];
  let n = 0;
  const fresh = () => n++;

  function g(node) {
    switch (node.type) {
      case 'num': return [literal(node.value), '0'];
      case 'const': {
        const [re, im] = COMPLEX_CONSTS[node.name];
        return [literal(re), literal(im)];
      }
      case 'var':
        switch (node.name) {
          case 'z': return ['zr', 'zi'];
          case 'x': return ['zr', '0'];
          case 'y': return ['zi', '0'];
          case 'a': return ['ar', 'ai'];
          default: throw new ExprError(`变量 ${node.name} 不可用`);
        }
      case 'neg': {
        if (node.arg.type === 'num') return [literal(-node.arg.value), '0'];
        const [r, i] = g(node.arg);
        const k = fresh();
        lines.push(`const r${k}=-(${r}),i${k}=-(${i});`);
        return [`r${k}`, `i${k}`];
      }
      case 'bin': return genBin(node);
      case 'call': return genCall(node);
      default: throw new ExprError('内部错误：未知节点');
    }
  }

  function genBin(node) {
    const [ar, ai] = g(node.left);
    if (node.op === '^' && node.right.type === 'num' && Number.isInteger(node.right.value) && Math.abs(node.right.value) <= 64) {
      const k = fresh();
      lines.push(`H.powi(${ar},${ai},${node.right.value},S);const r${k}=S[0],i${k}=S[1];`);
      return [`r${k}`, `i${k}`];
    }
    const [br, bi] = g(node.right);
    const k = fresh();
    switch (node.op) {
      case '+': lines.push(`const r${k}=${ar}+${br},i${k}=${ai}+${bi};`); break;
      case '-': lines.push(`const r${k}=${ar}-${br},i${k}=${ai}-${bi};`); break;
      case '*': lines.push(`const r${k}=${ar}*${br}-${ai}*${bi},i${k}=${ar}*${bi}+${ai}*${br};`); break;
      case '/': lines.push(`H.div(${ar},${ai},${br},${bi},S);const r${k}=S[0],i${k}=S[1];`); break;
      case '^': lines.push(`H.pow(${ar},${ai},${br},${bi},S);const r${k}=S[0],i${k}=S[1];`); break;
      default: throw new ExprError(`未知运算符 ${node.op}`);
    }
    return [`r${k}`, `i${k}`];
  }

  function genCall(node) {
    const args = node.args.map(g);
    const k = fresh();
    const [r, i] = args[0];
    switch (node.name) {
      case 're': return [r, '0'];
      case 'im': return [i, '0'];
      case 'conj': lines.push(`const r${k}=${r},i${k}=-(${i});`); break;
      case 'abs': lines.push(`const r${k}=Math.hypot(${r},${i}),i${k}=0;`); break;
      case 'arg': lines.push(`const r${k}=Math.atan2(${i},${r}),i${k}=0;`); break;
      case 'pow': {
        const [br, bi] = args[1];
        lines.push(`H.pow(${r},${i},${br},${bi},S);const r${k}=S[0],i${k}=S[1];`);
        break;
      }
      default: {
        const h = COMPLEX_HELPER[node.name];
        if (!h) throw new ExprError(`函数 ${node.name} 不支持复数`);
        lines.push(`H.${h}(${r},${i},S);const r${k}=S[0],i${k}=S[1];`);
      }
    }
    return [`r${k}`, `i${k}`];
  }

  const [r, i] = g(ast);
  lines.push(`out[0]=${r};out[1]=${i};`);
  return lines.join('\n');
}

/** Compile a complex AST to `(zr, zi, ar, ai, out) => void`. */
export function compileComplex(ast) {
  const body = genComplex(ast);
  return new Function('H', 'S', `"use strict"; return function(zr,zi,ar,ai,out){\n${body}\n};`)(H, new Float64Array(2));
}

/**
 * Parse + compile f(z). Returns { fn, ast, vars, usesParam, analytic } where `analytic` is a
 * syntactic hint: false if the expression uses x, y, conj, abs, arg, re or im.
 */
export function complexFunction(src) {
  const ast = parse(src, complexContext());
  const vars = variablesOf(ast);
  let analytic = !vars.has('x') && !vars.has('y');
  (function walk(n) {
    if (n.type === 'call' && ['conj', 'abs', 'arg', 're', 'im'].includes(n.name)) analytic = false;
    if (n.arg) walk(n.arg);
    if (n.left) { walk(n.left); walk(n.right); }
    if (n.args) n.args.forEach(walk);
  })(ast);
  return { fn: compileComplex(ast), ast, vars, usesParam: vars.has('a'), analytic };
}
