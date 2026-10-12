// The background universe: one cloud of particles that morphs from shape to shape as the visitor
// moves through the dimensions. Positions of the two procedural shapes (the trefoil's Milnor fibre
// and the Hopf fibration) are evaluated on the GPU every frame, so they can keep moving.

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { SHAPES } from './shapes.js';
import { KNOT_SCALE, knotCurve } from './fiber.js';
import { mulberry32 } from '../core/rng.js';

const HOPF_SCALE = 1.2;
const PAGES = 5;

// Camera + motion settings per shape.
export const RIGS = {
  galaxy: { cam: [0, 2.2, 7.4], look: [0, -0.2, 0], tilt: 0.95, rot: 0.035, spin: 0, pulse: 0.35, pf: 1.0, ps: 1.4, size: 1.25, gain: 1.7 },
  singularity: { cam: [0, 1.0, 6.6], look: [0, 0, 0], tilt: 0.3, rot: 0.0, spin: 1.4, pulse: 0.6, pf: 3.0, ps: 3.0, size: 1.0, gain: 0.85 },
  filament: { cam: [0, 0.2, 7.6], look: [0, 0, 0], tilt: 0.25, rot: 0.07, spin: 0, pulse: 1.0, pf: 1.0, ps: 2.2, size: 1.0, gain: 0.85 },
  landscape: { cam: [0, 4.4, 5.6], look: [0, -0.5, 0], tilt: 0.0, rot: 0.025, spin: 0, pulse: 0.25, pf: 3.1416, ps: 1.0, size: 0.95, gain: 1.1 },
  fiber: { cam: [0, 0, 7.6], look: [0, 0, 0], tilt: -0.35, rot: 0.06, spin: 0, pulse: 0.5, pf: 1.0, ps: 2.0, size: 0.9, gain: 0.68 },
  lorenz: { cam: [0, 0.3, 6.4], look: [0, 0.3, 0], tilt: 0.12, rot: 0.06, spin: 0, pulse: 1.0, pf: 1.0, ps: 3.0, size: 0.95, gain: 0.8 },
  latent: { cam: [0, 0.6, 7.0], look: [0, 0, 0], tilt: 0.15, rot: 0.05, spin: 0, pulse: 0.8, pf: 1.0, ps: 2.4, size: 1.05, gain: 0.85 },
  archive: { cam: [0, 2.4, 7.6], look: [0, 0.0, 0], tilt: 0.06, rot: 0.045, spin: 0, pulse: 1.0, pf: 1.0, ps: 2.6, size: 0.95, gain: 0.8 },
  hopf: { cam: [0, 0, 8.2], look: [0, 0, 0], tilt: -1.05, rot: 0.04, spin: 0, pulse: 0.4, pf: 1.0, ps: 1.0, size: 1.0, gain: 0.85 },
};

const VERT = /* glsl */ `
uniform float uTime, uMorph, uToProc, uProcKind, uTheta, uSpread, uPages, uSpinTo;
uniform float uSize, uPixelRatio, uFocus, uGain, uPulse, uPulseFreq, uPulseSpeed, uSwirl, uExplode;
uniform float uMouseStr, uAspect;
uniform vec2 uMouse;
uniform mat4 uHopfRot;
attribute vec3 aFrom;
attribute vec3 aTo;
attribute vec4 aColFrom;
attribute vec4 aColTo;
attribute vec4 aRand;
attribute vec4 aProc;
varying vec3 vColor;
varying float vAlpha;

vec2 crot(vec2 v, float a) { float c = cos(a), s = sin(a); return vec2(c * v.x - s * v.y, s * v.x + c * v.y); }
vec3 spinY(vec3 p, float spin) {
  if (spin == 0.0) return p;
  float a = spin * uTime / pow(0.35 + length(p.xz), 1.5);
  vec2 q = crot(p.xz, a);
  return vec3(q.x, p.y, q.y);
}
float gPage;
vec3 fiberPos(vec4 X) {
  float page = floor(aRand.w * uPages);
  gPage = page;
  float th = uTheta + 6.2831853 * page / uPages * uSpread;
  vec2 z = crot(X.xy, th * 0.5);
  vec2 w = crot(X.zw, th / 3.0);
  return vec3(w.x, w.y, z.x) / max(1.0 - z.y, 1e-3) * ${KNOT_SCALE.toFixed(4)};
}
vec3 hopfPos(vec4 P) {
  float t = P.z + uTime * 0.16;
  float ce = cos(P.x), se = sin(P.x);
  vec4 X = uHopfRot * vec4(ce * cos(P.y + t), ce * sin(P.y + t), se * cos(t), se * sin(t));
  return X.xyz / max(1.0 - X.w, 0.02) * ${HOPF_SCALE.toFixed(4)};
}

void main() {
  vec3 target = spinY(aTo, uSpinTo);
  float far = 0.0;
  if (uToProc > 0.5) {
    target = uProcKind < 1.5 ? fiberPos(aProc) : hopfPos(aProc);
    far = length(target);
  }
  float m = clamp((uMorph - aRand.x * 0.35) / 0.65, 0.0, 1.0);
  m = m * m * (3.0 - 2.0 * m);
  vec3 p = mix(aFrom, target, m);
  float sw = sin(3.14159265 * m) * uSwirl;
  vec3 q = p * 0.7 + aRand.yzw * 12.0;
  p += sw * (0.4 + aRand.y) * vec3(sin(q.y + uTime * 0.9), sin(q.z + uTime * 0.8), sin(q.x + uTime * 0.7));
  p += 0.01 * vec3(sin(uTime * 0.9 + aRand.y * 40.0), sin(uTime * 0.7 + aRand.z * 40.0), sin(uTime * 0.8 + aRand.w * 40.0));
  p *= 1.0 + uExplode * (0.6 + 5.0 * aRand.x * aRand.x);

  vec4 col = mix(aColFrom, aColTo, m);
  float pulse = pow(0.5 + 0.5 * sin(col.a * uPulseFreq - uTime * uPulseSpeed), 14.0);
  vColor = pow(max(col.rgb, 0.0), vec3(2.2)) * (1.0 + uPulse * pulse * 2.4);
  if (uToProc > 0.5 && uProcKind < 1.5) {
    vec3 tint = 0.62 + 0.38 * cos(6.2831853 * (gPage / uPages + vec3(0.0, 0.33, 0.67)));
    vColor *= mix(vec3(1.0), tint * 1.25, uSpread * m);
  }

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vec4 clip = projectionMatrix * mv;
  vec2 dd = (clip.xy / clip.w - uMouse) * vec2(uAspect, 1.0);
  float dist = length(dd);
  mv.xy += (dd / max(dist, 1e-4)) * uMouseStr * smoothstep(0.32, 0.0, dist) * (-mv.z) * 0.08;
  gl_Position = projectionMatrix * mv;
  float sz = uSize * (0.45 + 1.15 * aRand.y * aRand.y);
  gl_PointSize = clamp(sz * uPixelRatio * 7.0 / max(-mv.z, 0.1), 0.0, 48.0);
  float fade = uToProc > 0.5 ? mix(1.0, smoothstep(9.0, 4.8, far), m) : 1.0;
  vAlpha = uFocus * uGain * fade * (0.42 + 0.58 * aRand.z);
}`;

const FRAG = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d2 = dot(uv, uv);
  if (d2 > 0.25) discard;
  gl_FragColor = vec4(vColor * exp(-d2 * 16.0) * vAlpha, 1.0);
}`;

const TUBE_VERT = /* glsl */ `
uniform float uTime, uWobble;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vView;
void main() {
  vUv = uv;
  vec3 p = position + normal * uWobble * 0.22 * sin(uv.x * 37.7 + uTime * 13.0) + vec3(
    sin(uv.x * 18.85 + uTime * 7.0), cos(uv.x * 25.13 + uTime * 5.0), sin(uv.x * 12.57 - uTime * 6.0)) * uWobble * 0.45;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vView = -mv.xyz;
  vN = normalMatrix * normal;
  gl_Position = projectionMatrix * mv;
}`;
const TUBE_FRAG = /* glsl */ `
uniform float uTime, uOpacity;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vView;
void main() {
  float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vView))), 1.6);
  float pulse = pow(0.5 + 0.5 * sin(vUv.x * 18.85 - uTime * 2.4), 24.0);
  vec3 col = mix(vec3(1.0, 0.42, 0.14), vec3(1.0, 0.94, 0.84), 0.25 + 0.75 * fres) * (0.55 + 2.8 * pulse);
  gl_FragColor = vec4(pow(col, vec3(2.2)) * uOpacity, 1.0);
}`;

const FILM = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uCA: { value: 0 }, uGrain: { value: 0.028 }, uVignette: { value: 0.55 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
uniform sampler2D tDiffuse;
uniform float uTime, uCA, uGrain, uVignette;
varying vec2 vUv;
void main() {
  vec2 c = vUv - 0.5;
  float r2 = dot(c, c);
  vec2 off = c * (0.004 + uCA) * (0.4 + r2 * 3.0);
  vec3 col = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
  col *= 1.0 - uVignette * smoothstep(0.1, 0.62, r2 * 1.5);
  float n = fract(sin(dot(vUv * vec2(1931.3, 1033.7) + fract(uTime * 7.31) * 97.0, vec2(12.9898, 78.233))) * 43758.5453);
  col += (n - 0.5) * uGrain;
  gl_FragColor = vec4(col, 1.0);
}`,
};

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

export class Universe {
  constructor(canvas, { count = 65536, quality = 'high', pixelRatio = 1.5 } = {}) {
    this.canvas = canvas;
    this.count = count;
    this.quality = quality;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setClearColor(0x050508, 1);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.pixelRatio = pixelRatio;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(48, 1, 0.05, 200);
    this.camera.position.set(0, 2.3, 7.6);
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.look = new THREE.Vector3();

    this._initPoints();
    this._initKnot();
    this._initHopfLines();
    if (quality !== 'low') this._initPost();

    this.shapeCache = new Map();
    this.shape = null;
    this.rig = RIGS.galaxy;
    this.morphT = 1;
    this.morphDur = 2.2;
    this.state = {
      focus: 1, focusTarget: 1, warp: 0, mouse: new THREE.Vector2(0, 0), mouseTarget: new THREE.Vector2(0, 0), mouseOn: 0,
      dragX: 0, dragY: 0, velX: 0, velY: 0, rotY: 0, tilt: 0.5, theta: 0, thetaAuto: true, thetaSpeed: 0.22, spread: 0, spreadTarget: 0,
      explode: 0, explodeT: -1, wobble: 0, knotVis: 0, knotWanted: true, time: 0, hopfAngle: 0, zoom: 0,
    };
    this.resize();
  }

  _initPoints() {
    const n = this.count;
    const g = new THREE.BufferGeometry();
    const rand = mulberry32(2027);
    const rnd = new Float32Array(n * 4);
    for (let i = 0; i < rnd.length; i++) rnd[i] = rand();
    this.attr = {
      aFrom: new THREE.BufferAttribute(new Float32Array(n * 3), 3),
      aTo: new THREE.BufferAttribute(new Float32Array(n * 3), 3),
      aColFrom: new THREE.BufferAttribute(new Float32Array(n * 4), 4),
      aColTo: new THREE.BufferAttribute(new Float32Array(n * 4), 4),
      aRand: new THREE.BufferAttribute(rnd, 4),
      aProc: new THREE.BufferAttribute(new Float32Array(n * 4), 4),
    };
    for (const k of ['aFrom', 'aTo', 'aColFrom', 'aColTo', 'aProc']) this.attr[k].setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.attr.aFrom);
    for (const [k, a] of Object.entries(this.attr)) g.setAttribute(k, a);
    this.uniforms = {
      uTime: { value: 0 }, uMorph: { value: 1 }, uToProc: { value: 0 }, uProcKind: { value: 0 },
      uTheta: { value: 0 }, uSpread: { value: 0 }, uPages: { value: PAGES }, uSpinTo: { value: 0 },
      uSize: { value: 1 }, uPixelRatio: { value: 1 }, uFocus: { value: 1 }, uGain: { value: 1 }, uPulse: { value: 0.5 },
      uPulseFreq: { value: 1 }, uPulseSpeed: { value: 1 }, uSwirl: { value: 0 }, uExplode: { value: 0 },
      uMouseStr: { value: 0 }, uAspect: { value: 1 }, uMouse: { value: new THREE.Vector2(9, 9) },
      uHopfRot: { value: new THREE.Matrix4() },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: VERT, fragmentShader: FRAG,
      transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
    this.group.add(this.points);
  }

  _initKnot() {
    const pts = knotCurve(900).map((p) => new THREE.Vector3(p[0], p[1], p[2]));
    const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
    const geo = new THREE.TubeGeometry(curve, 900, 0.032, 10, true);
    this.knotUniforms = { uTime: { value: 0 }, uOpacity: { value: 0 }, uWobble: { value: 0 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.knotUniforms, vertexShader: TUBE_VERT, fragmentShader: TUBE_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.knot = new THREE.Mesh(geo, mat);
    this.knot.visible = false;
    this.group.add(this.knot);
  }

  _initHopfLines() {
    const RINGS = [0.36, 0.6, 0.8, 0.98], F = 24, SEG = 160;
    const n = RINGS.length * F * SEG * 2;
    const data = new Float32Array(n * 3);
    let o = 0;
    RINGS.forEach((eta, ring) => {
      for (let j = 0; j < F; j++) {
        const alpha = (j / F) * Math.PI * 2 + ring * 0.37;
        for (let k = 0; k < SEG; k++) {
          for (const kk of [k, k + 1]) { data[o++] = eta; data[o++] = alpha; data[o++] = (kk / SEG) * Math.PI * 2; }
        }
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(data, 3));
    this.hopfLineUniforms = { uTime: this.uniforms.uTime, uHopfRot: this.uniforms.uHopfRot, uOpacity: { value: 0 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.hopfLineUniforms,
      vertexShader: `uniform float uTime; uniform mat4 uHopfRot; varying vec3 vC; varying float vF;
        void main(){
          float eta = position.x, alpha = position.y, t = position.z;
          float ce = cos(eta), se = sin(eta);
          vec4 X = uHopfRot * vec4(ce * cos(alpha + t), ce * sin(alpha + t), se * cos(t), se * sin(t));
          vec3 p = X.xyz / max(1.0 - X.w, 0.02) * ${HOPF_SCALE.toFixed(4)};
          vF = smoothstep(9.0, 4.0, length(p));
          vC = 0.55 + 0.45 * cos(6.2831853 * (alpha / 6.2831853 + vec3(0.0, 0.33, 0.67)));
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: `uniform float uOpacity; varying vec3 vC; varying float vF;
        void main(){ gl_FragColor = vec4(pow(vC, vec3(2.2)) * 0.55 * uOpacity * vF, 1.0); }`,
      transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    });
    this.hopfLines = new THREE.LineSegments(g, mat);
    this.hopfLines.frustumCulled = false;
    this.hopfLines.visible = false;
    this.group.add(this.hopfLines);
  }

  _initPost() {
    const composer = new EffectComposer(this.renderer);
    composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.7, 0.42, 0.16);
    composer.addPass(this.bloom);
    composer.addPass(new OutputPass());
    this.film = new ShaderPass(FILM);
    composer.addPass(this.film);
    this.composer = composer;
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 0.8 ? 62 : 48;
    this.camera.updateProjectionMatrix();
    this.uniforms.uAspect.value = w / h;
    this.uniforms.uPixelRatio.value = this.pixelRatio * Math.min(1.25, Math.max(0.7, h / 900));
    if (this.composer) {
      this.composer.setPixelRatio(this.pixelRatio);
      this.composer.setSize(w, h);
      this.bloom.resolution.set(w / 2, h / 2);
    }
    this.width = w; this.height = h;
  }

  getShape(name) {
    if (!this.shapeCache.has(name)) this.shapeCache.set(name, SHAPES[name](this.count));
    return this.shapeCache.get(name);
  }

  // Prepare shapes ahead of time (in idle slices) so switching never stalls a frame.
  warm(names) {
    const queue = [...names];
    const next = () => {
      const name = queue.shift();
      if (!name) return;
      this.getShape(name);
      (window.requestIdleCallback || ((f) => setTimeout(f, 60)))(next);
    };
    next();
  }

  hopfMatrix(a, out = new THREE.Matrix4()) {
    const c1 = Math.cos(a), s1 = Math.sin(a), c2 = Math.cos(a * 0.62), s2 = Math.sin(a * 0.62);
    // rotation in the (x1, x4) plane by a and in the (x2, x3) plane by 0.62a (row-major set)
    out.set(c1, 0, 0, -s1, 0, c2, -s2, 0, 0, s2, c2, 0, s1, 0, 0, c1);
    return out;
  }

  // Current displayed position/colour of every particle, computed on the CPU exactly as the
  // vertex shader does (minus the purely decorative wobble), so a new morph starts from it.
  _snapshot() {
    const n = this.count;
    const u = this.uniforms;
    const from = this.attr.aFrom.array, to = this.attr.aTo.array;
    const cf = this.attr.aColFrom.array, ct = this.attr.aColTo.array;
    const rnd = this.attr.aRand.array, proc = this.attr.aProc.array;
    const morph = u.uMorph.value, toProc = u.uToProc.value > 0.5, kind = u.uProcKind.value;
    const t = u.uTime.value, spin = u.uSpinTo.value;
    const hm = u.uHopfRot.value.elements; // column-major
    const posOut = new Float32Array(n * 3), colOut = new Float32Array(n * 4);
    const theta = u.uTheta.value, spread = u.uSpread.value;
    for (let i = 0; i < n; i++) {
      let m = Math.min(1, Math.max(0, (morph - rnd[i * 4] * 0.35) / 0.65));
      m = m * m * (3 - 2 * m);
      let tx, ty, tz;
      if (toProc) {
        const X0 = proc[i * 4], X1 = proc[i * 4 + 1], X2 = proc[i * 4 + 2], X3 = proc[i * 4 + 3];
        if (kind < 1.5) {
          const page = Math.floor(rnd[i * 4 + 3] * PAGES);
          const th = theta + (2 * Math.PI * page / PAGES) * spread;
          const c1 = Math.cos(th / 2), s1 = Math.sin(th / 2), c2 = Math.cos(th / 3), s2 = Math.sin(th / 3);
          const zr = c1 * X0 - s1 * X1, zi = s1 * X0 + c1 * X1;
          const wr = c2 * X2 - s2 * X3, wi = s2 * X2 + c2 * X3;
          const d = Math.max(1 - zi, 1e-3);
          tx = (wr / d) * KNOT_SCALE; ty = (wi / d) * KNOT_SCALE; tz = (zr / d) * KNOT_SCALE;
        } else {
          const tt = X2 + t * 0.16;
          const ce = Math.cos(X0), se = Math.sin(X0);
          const v = [ce * Math.cos(X1 + tt), ce * Math.sin(X1 + tt), se * Math.cos(tt), se * Math.sin(tt)];
          const o = [0, 0, 0, 0];
          for (let r = 0; r < 4; r++) o[r] = hm[r] * v[0] + hm[4 + r] * v[1] + hm[8 + r] * v[2] + hm[12 + r] * v[3];
          const d = Math.max(1 - o[3], 0.02);
          tx = (o[0] / d) * HOPF_SCALE; ty = (o[1] / d) * HOPF_SCALE; tz = (o[2] / d) * HOPF_SCALE;
        }
      } else {
        tx = to[i * 3]; ty = to[i * 3 + 1]; tz = to[i * 3 + 2];
        if (spin) {
          const a = (spin * t) / Math.pow(0.35 + Math.hypot(tx, tz), 1.5);
          const c = Math.cos(a), s = Math.sin(a);
          const x = c * tx - s * tz; tz = s * tx + c * tz; tx = x;
        }
      }
      let x = from[i * 3] + (tx - from[i * 3]) * m;
      let y = from[i * 3 + 1] + (ty - from[i * 3 + 1]) * m;
      let z = from[i * 3 + 2] + (tz - from[i * 3 + 2]) * m;
      const r = Math.hypot(x, y, z);
      if (r > 10) { x *= 10 / r; y *= 10 / r; z *= 10 / r; }
      posOut[i * 3] = x; posOut[i * 3 + 1] = y; posOut[i * 3 + 2] = z;
      for (let k = 0; k < 4; k++) colOut[i * 4 + k] = cf[i * 4 + k] + (ct[i * 4 + k] - cf[i * 4 + k]) * m;
    }
    return { pos: posOut, col: colOut };
  }

  setShape(name, { instant = false } = {}) {
    if (name === this.shape || !SHAPES[name]) return;
    const target = this.getShape(name);
    const rig = RIGS[name];
    const u = this.uniforms;
    const first = this.shape === null;
    if (first || instant) {
      this.attr.aFrom.array.set(target.pos);
      this.attr.aColFrom.array.set(target.col);
    } else {
      const snap = this._snapshot();
      this.attr.aFrom.array.set(snap.pos);
      this.attr.aColFrom.array.set(snap.col);
    }
    this.attr.aTo.array.set(target.pos);
    this.attr.aColTo.array.set(target.col);
    const proc = name === 'fiber' ? 1 : name === 'hopf' ? 2 : 0;
    if (proc) this.attr.aProc.array.set(target.proc);
    for (const k of ['aFrom', 'aTo', 'aColFrom', 'aColTo', 'aProc']) this.attr[k].needsUpdate = true;
    u.uToProc.value = proc ? 1 : 0;
    u.uProcKind.value = proc;
    u.uSpinTo.value = rig.spin;
    u.uPulseFreq.value = rig.pf;
    u.uPulseSpeed.value = rig.ps;
    this.prevShape = this.shape;
    this.shape = name;
    this.rig = rig;
    u.uMorph.value = first || instant ? 1 : 0;
    this.morphT = u.uMorph.value;
    if (name === 'fiber') this.state.theta = 0;
  }

  // Jump every animated quantity to its target (used by the screenshot tour on software WebGL).
  settle() {
    const rig = this.rig, s = this.state;
    this.morphT = 1; this.uniforms.uMorph.value = 1;
    s.focus = s.focusTarget; s.tilt = rig.tilt; s.spread = s.spreadTarget;
    this.camera.position.set(...rig.cam);
    this.look.set(...rig.look);
    this.camera.lookAt(this.look);
  }

  setFocus(v) { this.state.focusTarget = v; }
  setWarp(v) { this.state.warp = v; }
  setMouse(x, y, on = true) { this.state.mouseTarget.set(x, y); this.state.mouseOn = on ? 1 : 0; }
  drag(dx, dy) { this.state.velX = dx * 0.006; this.state.velY = dy * 0.004; this.state.dragX += dx * 0.006; this.state.dragY += dy * 0.004; }
  resetView() { this.state.dragX = 0; this.state.dragY = 0; this.state.velX = 0; this.state.velY = 0; }
  explode() { this.state.explodeT = 0; }
  wobbleKnot() { this.state.wobble = 1; }
  setTheta(v) { this.state.theta = v; this.state.thetaAuto = false; }
  setThetaAuto(on) { this.state.thetaAuto = on; }
  setOpenBook(on) { this.state.spreadTarget = on ? 1 : 0; }
  setKnot(on) { this.state.knotWanted = on; }
  setZoom(z) { this.state.zoom = z; }

  // Screen position (CSS pixels) of an object-space point; null when behind the camera.
  toScreen(x, y, z, out = { x: 0, y: 0, depth: 0 }) {
    const v = this._v || (this._v = new THREE.Vector3());
    v.set(x, y, z).applyMatrix4(this.group.matrixWorld).project(this.camera);
    if (v.z > 1) return null;
    out.x = (v.x * 0.5 + 0.5) * this.width;
    out.y = (-v.y * 0.5 + 0.5) * this.height;
    out.depth = v.z;
    return out;
  }

  frame(dt, time) {
    const s = this.state, u = this.uniforms, rig = this.rig;
    s.time = time;
    u.uTime.value = time;
    // morph
    if (this.morphT < 1) {
      this.morphT = Math.min(1, this.morphT + dt / this.morphDur);
      u.uMorph.value = ease(this.morphT);
      u.uSwirl.value = 0.55;
    } else {
      u.uSwirl.value = 0;
    }
    // focus / pulse / size
    s.focus = damp(s.focus, s.focusTarget, 3, dt);
    u.uFocus.value = s.focus;
    u.uPulse.value = rig.pulse;
    u.uSize.value = damp(u.uSize.value, rig.size, 2, dt);
    u.uGain.value = damp(u.uGain.value, rig.gain, 2, dt);
    // fibre angle
    if (s.thetaAuto) s.theta += dt * s.thetaSpeed;
    u.uTheta.value = s.theta;
    s.spread = damp(s.spread, s.spreadTarget, 2.2, dt);
    u.uSpread.value = s.spread;
    // Hopf rotation
    s.hopfAngle = 0.42 * Math.sin(time * 0.11);
    this.hopfMatrix(s.hopfAngle, u.uHopfRot.value);
    // explosion egg: out and back
    if (s.explodeT >= 0) {
      s.explodeT += dt;
      const k = s.explodeT;
      u.uExplode.value = k < 0.5 ? Math.sin((k / 0.5) * Math.PI / 2) * 1.0 : Math.max(0, 1 - (k - 0.5) / 2.2) ** 2;
      if (k > 2.8) { s.explodeT = -1; u.uExplode.value = 0; }
    }
    // mouse
    s.mouse.x = damp(s.mouse.x, s.mouseTarget.x, 8, dt);
    s.mouse.y = damp(s.mouse.y, s.mouseTarget.y, 8, dt);
    u.uMouse.value.copy(s.mouse);
    u.uMouseStr.value = damp(u.uMouseStr.value, s.mouseOn ? 1 : 0, 4, dt);
    // knot tube
    const knotTarget = this.shape === 'fiber' && s.knotWanted ? Math.min(1, u.uMorph.value * 1.2) : 0;
    s.knotVis = damp(s.knotVis, knotTarget, 3, dt);
    this.knot.visible = s.knotVis > 0.01;
    this.knotUniforms.uOpacity.value = s.knotVis * s.focus;
    this.knotUniforms.uTime.value = time;
    s.wobble = damp(s.wobble, 0, 1.4, dt);
    this.knotUniforms.uWobble.value = s.wobble;

    // Hopf fibres as crisp loops
    const hopfTarget = this.shape === 'hopf' ? u.uMorph.value : 0;
    const hl = this.hopfLineUniforms.uOpacity;
    hl.value = damp(hl.value, hopfTarget * s.focus, 2.5, dt);
    this.hopfLines.visible = hl.value > 0.01;

    // object motion: tilt + spin + drag inertia
    if (Math.abs(s.velX) > 1e-5 || Math.abs(s.velY) > 1e-5) {
      s.velX *= Math.exp(-dt * 3); s.velY *= Math.exp(-dt * 3);
      s.dragX += s.velX * dt * 4; s.dragY += s.velY * dt * 4;
    }
    s.rotY += dt * rig.rot;
    s.tilt = damp(s.tilt, rig.tilt, 1.5, dt);
    this.group.rotation.y = s.rotY + s.dragX;
    this.group.rotation.x = Math.max(-1.4, Math.min(1.4, s.tilt + s.dragY));

    // camera rig with parallax and warp
    const cam = this.camera;
    const k = 1.4;
    const zoom = 1 - s.zoom * 0.25;
    cam.position.x = damp(cam.position.x, rig.cam[0] * zoom + s.mouse.x * 0.35, k, dt);
    cam.position.y = damp(cam.position.y, rig.cam[1] * zoom + s.mouse.y * 0.25, k, dt);
    cam.position.z = damp(cam.position.z, rig.cam[2] * zoom, k, dt);
    this.look.x = damp(this.look.x, rig.look[0], k, dt);
    this.look.y = damp(this.look.y, rig.look[1], k, dt);
    this.look.z = damp(this.look.z, rig.look[2], k, dt);
    cam.lookAt(this.look);
    const baseFov = this.width / this.height < 0.8 ? 62 : 48;
    const fov = baseFov + s.warp * 14;
    if (Math.abs(cam.fov - fov) > 0.01) { cam.fov = damp(cam.fov, fov, 6, dt); cam.updateProjectionMatrix(); }

    if (this.composer) {
      this.film.uniforms.uTime.value = time;
      this.film.uniforms.uCA.value = damp(this.film.uniforms.uCA.value, s.warp * 0.03, 6, dt);
      this.bloom.strength = 0.7 + s.warp * 0.6;
      this.composer.render(dt);
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  dispose() {
    this.renderer.dispose();
  }
}

export function createUniverse(canvas, opts) {
  try {
    return new Universe(canvas, opts);
  } catch (err) {
    console.warn('[universe] WebGL unavailable, falling back to CSS backdrop:', err);
    return null;
  }
}
