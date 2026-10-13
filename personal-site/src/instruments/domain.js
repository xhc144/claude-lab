// EXP-01 · Phase portrait lab. Any f(z) typed by the visitor is parsed by a small whitelist grammar,
// compiled to GLSL (and, for the hover readout, to a JS closure) and painted on the GPU:
// hue = arg f(z), brightness steps = every doubling of |f(z)|.
import { Instrument } from './base.js';

// ---------- parsing ----------
const FUNCS = new Set(['sin', 'cos', 'tan', 'exp', 'log', 'sqrt', 'sinh', 'cosh', 'tanh', 'conj', 'abs', 're', 'im', 'arg']);

function tokenize(src) {
  const s = src.replace(/[×·∙]/g, '*').replace(/÷/g, '/').replace(/[−–]/g, '-').replace(/π/g, 'pi').replace(/\*\*/g, '^').replace(/\s+/g, '');
  const out = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    const num = /^(\d+\.?\d*|\.\d+)/.exec(s.slice(i));
    if (num) { out.push({ k: 'num', v: Number(num[1]), at: i }); i += num[1].length; continue; }
    const id = /^[a-zA-Z]+/.exec(s.slice(i));
    if (id) {
      let word = id[0].toLowerCase();
      // split unknown words into single-letter factors: "zi" → z · i
      const pieces = [];
      while (word.length) {
        const f = [...FUNCS, 'pi'].sort((a, b) => b.length - a.length).find((n) => word.startsWith(n));
        if (f) { pieces.push(f); word = word.slice(f.length); }
        else { pieces.push(word[0]); word = word.slice(1); }
      }
      for (const p of pieces) {
        if (!FUNCS.has(p) && !['z', 'i', 't', 'e', 'pi'].includes(p)) throw new Error(`不认识的符号 “${p}”`);
        out.push({ k: FUNCS.has(p) ? 'fn' : 'id', v: p, at: i });
      }
      i += id[0].length;
      continue;
    }
    if ('+-*/^(),'.includes(c)) { out.push({ k: c, at: i }); i++; continue; }
    throw new Error(`第 ${i + 1} 个字符 “${c}” 无法识别`);
  }
  return out;
}

export function parse(src) {
  const toks = tokenize(src);
  if (!toks.length) throw new Error('请输入一个函数');
  let p = 0;
  const peek = () => toks[p];
  const eat = (k) => { const t = toks[p]; if (!t || t.k !== k) throw new Error(`缺少 “${k}”`); p++; return t; };
  const startsAtom = (t) => t && (t.k === 'num' || t.k === 'id' || t.k === 'fn' || t.k === '(');
  function expr() {
    let a = term();
    while (peek() && (peek().k === '+' || peek().k === '-')) { const op = toks[p++].k; a = { t: 'bin', op, a, b: term() }; }
    return a;
  }
  function term() {
    let a = unary();
    for (;;) {
      const t = peek();
      if (t && (t.k === '*' || t.k === '/')) { p++; a = { t: 'bin', op: t.k, a, b: unary() }; }
      else if (startsAtom(t)) a = { t: 'bin', op: '*', a, b: power() }; // implicit multiplication
      else return a;
    }
  }
  function unary() {
    const t = peek();
    if (t && t.k === '-') { p++; return { t: 'neg', a: unary() }; }
    if (t && t.k === '+') { p++; return unary(); }
    return power();
  }
  function power() {
    const base = atom();
    if (peek() && peek().k === '^') { p++; return { t: 'bin', op: '^', a: base, b: unary() }; }
    return base;
  }
  function atom() {
    const t = toks[p++];
    if (!t) throw new Error('表达式不完整');
    if (t.k === 'num') return { t: 'num', v: t.v };
    if (t.k === 'id') return { t: t.v };
    if (t.k === 'fn') { eat('('); const a = expr(); eat(')'); return { t: 'fn', name: t.v, a }; }
    if (t.k === '(') { const a = expr(); eat(')'); return a; }
    throw new Error(`第 ${t.at + 1} 个字符处语法错误`);
  }
  const ast = expr();
  if (p < toks.length) throw new Error(`第 ${toks[p].at + 1} 个字符处多余的 “${toks[p].k === 'num' ? toks[p].v : toks[p].v || toks[p].k}”`);
  return ast;
}

const usesT = (n) => n.t === 't' || (n.a && usesT(n.a)) || (n.b && usesT(n.b));
const intPow = (n) => n.t === 'num' && Number.isInteger(n.v) && n.v <= 24;
const negIntPow = (n) => n.t === 'neg' && intPow(n.a);

// ---------- GLSL ----------
const flt = (v) => (Number.isInteger(v) ? v.toFixed(1) : String(v));
export function toGLSL(n) {
  switch (n.t) {
    case 'num': return `vec2(${flt(n.v)}, 0.0)`;
    case 'i': return 'vec2(0.0, 1.0)';
    case 'z': return 'z';
    case 't': return 'uT';
    case 'pi': return 'vec2(3.14159265, 0.0)';
    case 'e': return 'vec2(2.71828183, 0.0)';
    case 'neg': return `(-${toGLSL(n.a)})`;
    case 'fn': return `c${n.name}(${toGLSL(n.a)})`;
    case 'bin': {
      const a = toGLSL(n.a), b = toGLSL(n.b);
      if (n.op === '+') return `(${a} + ${b})`;
      if (n.op === '-') return `(${a} - ${b})`;
      if (n.op === '*') return `cmul(${a}, ${b})`;
      if (n.op === '/') return `cdiv(${a}, ${b})`;
      if (intPow(n.b)) return `cpowi(${a}, ${n.b.v})`;
      if (negIntPow(n.b)) return `cdiv(vec2(1.0, 0.0), cpowi(${a}, ${n.b.a.v}))`;
      return `cpow(${a}, ${b})`;
    }
  }
  throw new Error('bad node');
}

// ---------- JS (hover readout) ----------
const C = {
  mul: (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]],
  div: (a, b) => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; },
  exp: (a) => [Math.exp(a[0]) * Math.cos(a[1]), Math.exp(a[0]) * Math.sin(a[1])],
  log: (a) => [Math.log(Math.hypot(a[0], a[1])), Math.atan2(a[1], a[0])],
};
C.pow = (a, b) => (a[0] === 0 && a[1] === 0 ? [0, 0] : C.exp(C.mul(b, C.log(a))));
C.powi = (a, n) => { let r = [1, 0]; for (let k = 0; k < n; k++) r = C.mul(r, a); return r; };
const F = {
  sin: (a) => [Math.sin(a[0]) * Math.cosh(a[1]), Math.cos(a[0]) * Math.sinh(a[1])],
  cos: (a) => [Math.cos(a[0]) * Math.cosh(a[1]), -Math.sin(a[0]) * Math.sinh(a[1])],
  sinh: (a) => [Math.sinh(a[0]) * Math.cos(a[1]), Math.cosh(a[0]) * Math.sin(a[1])],
  cosh: (a) => [Math.cosh(a[0]) * Math.cos(a[1]), Math.sinh(a[0]) * Math.sin(a[1])],
  exp: C.exp, log: C.log,
  sqrt: (a) => { const r = Math.hypot(a[0], a[1]); return [Math.sqrt((r + a[0]) / 2), (a[1] < 0 ? -1 : 1) * Math.sqrt(Math.max(0, (r - a[0]) / 2))]; },
  conj: (a) => [a[0], -a[1]], abs: (a) => [Math.hypot(a[0], a[1]), 0], re: (a) => [a[0], 0], im: (a) => [a[1], 0], arg: (a) => [Math.atan2(a[1], a[0]), 0],
};
F.tan = (a) => C.div(F.sin(a), F.cos(a));
F.tanh = (a) => C.div(F.sinh(a), F.cosh(a));
export function toJS(n) {
  switch (n.t) {
    case 'num': return () => [n.v, 0];
    case 'i': return () => [0, 1];
    case 'z': return (z) => z;
    case 't': return (z, t) => t;
    case 'pi': return () => [Math.PI, 0];
    case 'e': return () => [Math.E, 0];
    case 'neg': { const a = toJS(n.a); return (z, t) => { const v = a(z, t); return [-v[0], -v[1]]; }; }
    case 'fn': { const a = toJS(n.a), f = F[n.name]; return (z, t) => f(a(z, t)); }
    case 'bin': {
      const a = toJS(n.a), b = toJS(n.b);
      if (n.op === '+') return (z, t) => { const u = a(z, t), v = b(z, t); return [u[0] + v[0], u[1] + v[1]]; };
      if (n.op === '-') return (z, t) => { const u = a(z, t), v = b(z, t); return [u[0] - v[0], u[1] - v[1]]; };
      if (n.op === '*') return (z, t) => C.mul(a(z, t), b(z, t));
      if (n.op === '/') return (z, t) => C.div(a(z, t), b(z, t));
      if (intPow(n.b)) return (z, t) => C.powi(a(z, t), n.b.v);
      return (z, t) => C.pow(a(z, t), b(z, t));
    }
  }
  throw new Error('bad node');
}

const LIB = /* glsl */ `
precision highp float;
uniform vec2 uRes, uCenter, uT;
uniform float uScale, uS;
vec2 cmul(vec2 a, vec2 b) { return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x); }
vec2 cdiv(vec2 a, vec2 b) { float d = dot(b, b); return vec2(a.x * b.x + a.y * b.y, a.y * b.x - a.x * b.y) / d; }
vec2 cexp(vec2 a) { return exp(a.x) * vec2(cos(a.y), sin(a.y)); }
vec2 clog(vec2 a) { return vec2(log(length(a)), atan(a.y, a.x)); }
vec2 cpow(vec2 a, vec2 b) { if (dot(a, a) == 0.0) return vec2(0.0); return cexp(cmul(b, clog(a))); }
vec2 cpowi(vec2 a, int n) { vec2 r = vec2(1.0, 0.0); for (int k = 0; k < 24; k++) { if (k >= n) break; r = cmul(r, a); } return r; }
float sh(float x) { return 0.5 * (exp(x) - exp(-x)); }
float ch(float x) { return 0.5 * (exp(x) + exp(-x)); }
vec2 csin(vec2 a) { return vec2(sin(a.x) * ch(a.y), cos(a.x) * sh(a.y)); }
vec2 ccos(vec2 a) { return vec2(cos(a.x) * ch(a.y), -sin(a.x) * sh(a.y)); }
vec2 csinh(vec2 a) { return vec2(sh(a.x) * cos(a.y), ch(a.x) * sin(a.y)); }
vec2 ccosh(vec2 a) { return vec2(ch(a.x) * cos(a.y), sh(a.x) * sin(a.y)); }
vec2 ctan(vec2 a) { return cdiv(csin(a), ccos(a)); }
vec2 ctanh(vec2 a) { return cdiv(csinh(a), ccosh(a)); }
vec2 cexp_(vec2 a) { return cexp(a); }
vec2 csqrt(vec2 a) { float r = length(a); return vec2(sqrt(max(0.0, 0.5 * (r + a.x))), (a.y < 0.0 ? -1.0 : 1.0) * sqrt(max(0.0, 0.5 * (r - a.x)))); }
vec2 cconj(vec2 a) { return vec2(a.x, -a.y); }
vec2 cabs(vec2 a) { return vec2(length(a), 0.0); }
vec2 cre(vec2 a) { return vec2(a.x, 0.0); }
vec2 cim(vec2 a) { return vec2(a.y, 0.0); }
vec2 carg(vec2 a) { return vec2(atan(a.y, a.x), 0.0); }
vec3 pal(float h) { return 0.5 + 0.5 * cos(6.2831853 * (h + vec3(0.0, 0.333, 0.667))); }
`;

function fragment(body) {
  return `${LIB}
vec2 F(vec2 z) { return ${body}; }
void main() {
  vec2 z = uCenter + (gl_FragCoord.xy - 0.5 * uRes) * uScale;
  vec2 w = mix(z, F(z), uS);
  float r = length(w);
  float h = atan(w.y, w.x) / 6.2831853;
  float lr = log2(max(r, 1e-30));
  float m = fract(lr);
  float ph = fract(h * 12.0);
  float shade = (0.6 + 0.4 * m) * (0.84 + 0.16 * ph);
  vec3 col = pal(h) * shade;
  col = mix(col, vec3(1.0), smoothstep(7.0, 22.0, lr));
  col = mix(col, vec3(0.0), smoothstep(-7.0, -22.0, lr));
  float ax = min(abs(z.x), abs(z.y)) / uScale;
  col = mix(col, vec3(1.0), 0.28 * (1.0 - smoothstep(0.0, 1.4, ax)));
  if (!(r < 1e38)) col = vec3(1.0);
  if (r != r) col = vec3(0.22);
  gl_FragColor = vec4(col, 1.0);
}`;
}

const VERT = 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }';

export const PRESETS = [
  ['有理函数', '(z^2-1)*(z-2-i)^2/(z^2+2+2i)'],
  ['恒等 z', 'z'],
  ['单位根', 'z^5-1'],
  ['本性奇点', 'exp(1/z)'],
  ['sin z', 'sin(z)'],
  ['Blaschke 积', '(z-0.5-0.3i)/(1-(0.5-0.3i)z)*(z+0.6)/(1+0.6z)'],
  ['旋转的根', 'z^3-t'],
  ['对数割线', 'log(z)'],
  ['tan z', 'tan(z)'],
];

export class Domain extends Instrument {
  init() {
    this.host.dataset.cursorLabel = 'DRAG · 平移';
    const gl = this.canvas.getContext('webgl', { antialias: false, preserveDrawingBuffer: false });
    if (!gl) throw new Error('WebGL unavailable');
    this.gl = gl;
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    this.center = [0, 0];
    this.halfH = 3.2; // world units from centre to top edge
    this.s = 1; this.sTarget = 1;
    this.input = this.host.querySelector('.fx-input input');
    this.err = this.host.querySelector('.fx-err');
    this.setExpr(this.input ? this.input.value : PRESETS[0][1]);

    const chips = this.host.querySelector('[data-presets]');
    if (chips) {
      chips.innerHTML = '';
      const btns = PRESETS.map(([label, ex], k) => {
        const b = document.createElement('button');
        b.className = 'chip mono' + (k === 0 ? ' is-on' : '');
        b.textContent = label;
        b.addEventListener('click', () => {
          for (const x of btns) x.classList.toggle('is-on', x === b);
          this.input.value = ex;
          this.setExpr(ex, true);
        });
        chips.appendChild(b);
        return b;
      });
      const zoom = (f) => { this.halfH = Math.min(60, Math.max(0.05, this.halfH * f)); this.dirty = true; };
      for (const [label, fn] of [['＋', () => zoom(0.7)], ['－', () => zoom(1 / 0.7)], ['复位', () => { this.center = [0, 0]; this.halfH = 3.2; this.dirty = true; }]]) {
        const b = document.createElement('button');
        b.className = 'chip mono';
        b.textContent = label;
        b.addEventListener('click', fn);
        chips.appendChild(b);
      }
    }
    if (this.input) {
      let timer = 0;
      this.input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => this.setExpr(this.input.value, true), 260); });
      this.input.addEventListener('keydown', (e) => e.stopPropagation());
    }
    let last = null;
    this.pointer({
      down: (x, y) => { last = [x, y]; },
      move: (x, y) => {
        const k = this.scale();
        this.center[0] -= (x - last[0]) * k; this.center[1] += (y - last[1]) * k;
        last = [x, y]; this.dirty = true; this.hover(x, y);
      },
      hover: (x, y) => this.hover(x, y),
    });
    this.canvas.addEventListener('wheel', (e) => {
      if (!e.ctrlKey && !this.large) return; // keep page scrolling; pinch / ctrl+wheel / lab view zooms
      e.preventDefault();
      const r = this.canvas.getBoundingClientRect();
      const k = this.scale();
      const zx = this.center[0] + (e.clientX - r.left - this.w / 2) * k, zy = this.center[1] - (e.clientY - r.top - this.h / 2) * k;
      const f = Math.exp(e.deltaY * 0.0015);
      this.halfH = Math.min(60, Math.max(0.05, this.halfH * f));
      const k2 = this.scale();
      this.center = [zx - (e.clientX - r.left - this.w / 2) * k2, zy + (e.clientY - r.top - this.h / 2) * k2];
      this.dirty = true;
    }, { passive: false });
  }

  scale() { return (this.halfH * 2) / Math.max(1, this.h); } // world units per CSS pixel

  setExpr(src, animate = false) {
    let ast;
    try {
      ast = parse(src);
      const prog = this.compile(fragment(toGLSL(ast)));
      if (this.prog) this.gl.deleteProgram(this.prog);
      this.prog = prog;
      this.fn = toJS(ast);
      this.animated = usesT(ast);
      if (this.err) this.err.textContent = '';
      this.input?.parentElement.classList.remove('bad');
      if (animate) { this.s = 0; this.sTarget = 1; }
      this.dirty = true;
    } catch (err) {
      if (this.err) this.err.textContent = err.message;
      this.input?.parentElement.classList.add('bad');
    }
  }

  compile(fsrc) {
    const gl = this.gl;
    const sh = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('着色器编译失败：' + (gl.getShaderInfoLog(s) || '').split('\n')[0]);
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fsrc));
    gl.bindAttribLocation(p, 0, 'p');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('着色器链接失败');
    p.u = {};
    for (const n of ['uRes', 'uCenter', 'uT', 'uScale', 'uS']) p.u[n] = gl.getUniformLocation(p, n);
    return p;
  }

  hover(x, y) {
    if (!this.fn) return;
    const k = this.scale();
    const z = [this.center[0] + (x - this.w / 2) * k, this.center[1] - (y - this.h / 2) * k];
    const t = [Math.cos(this.time * 0.5), Math.sin(this.time * 0.5)];
    const w = this.fn(z, t);
    const fmt = (c) => `${c[0].toFixed(3)} ${c[1] < 0 ? '−' : '+'} ${Math.abs(c[1]).toFixed(3)}i`;
    this.readout('z', fmt(z));
    this.readout('fz', Number.isFinite(w[0]) && Number.isFinite(w[1]) ? fmt(w) : '∞');
    const m = Math.hypot(w[0], w[1]);
    this.readout('mod', Number.isFinite(m) ? (m > 1e5 ? m.toExponential(2) : m.toFixed(4)) : '∞');
    this.readout('arg', `${((Math.atan2(w[1], w[0]) * 180) / Math.PI).toFixed(1)}°`);
  }

  onResize() { this.dirty = true; }

  frame(dt) {
    if (this.s < this.sTarget) { this.s = Math.min(1, this.s + dt / 1.3); this.dirty = true; }
    if (!this.dirty && !this.animated) return;
    this.dirty = false;
    const gl = this.gl, p = this.prog;
    if (!p) return;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(p);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(p.u.uRes, this.canvas.width, this.canvas.height);
    gl.uniform2f(p.u.uCenter, this.center[0], this.center[1]);
    gl.uniform2f(p.u.uT, Math.cos(this.time * 0.5), Math.sin(this.time * 0.5));
    gl.uniform1f(p.u.uScale, this.scale() / this.dpr);
    const e = this.s < 1 ? 1 - Math.pow(1 - this.s, 3) : 1;
    gl.uniform1f(p.u.uS, e);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  destroy() {
    super.destroy();
    this.gl?.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
