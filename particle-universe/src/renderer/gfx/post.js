// HDR post-processing: lens + trails → background → bloom / anamorphic flare → ACES composite.
import { Program, Texture, Target, FULLSCREEN_VS } from './gl.js';
import { HEADER, CONST, RNG, NOISE, ACES } from './glsl/common.js';

const LENS = `
uniform vec4 uLens;     // center.xy (uv), shadow radius, einstein radius (height-normalised)
uniform float uLensAmt;
uniform float uAspect;
vec2 lensUV(vec2 uv, out float mask, out float rN) {
  vec2 d = (uv - uLens.xy) * vec2(uAspect, 1.0);
  float r = max(length(d), 1e-5);
  float re = uLens.w * uLensAmt;
  float rs = uLens.z * uLensAmt;
  float beta = r - re * re / r;
  vec2 src = uLens.xy + (d / r) * beta / vec2(uAspect, 1.0);
  mask = smoothstep(rs * 0.985, rs * 1.015 + 1e-5, r);
  rN = r / max(rs, 1e-5);
  return src;
}`;

const TRAIL_FS = HEADER + LENS + `
in vec2 vUv;
uniform sampler2D uScene;
uniform sampler2D uFront;
uniform sampler2D uPrev;
uniform float uDecay, uComp;
uniform vec4 uWarp; // zoom, rotation, shift.xy
uniform vec4 uRing; // rgb, intensity
out vec4 o;
void main() {
  vec3 cur;
  if (uLensAmt > 0.001) {
    float m, rN;
    vec2 s = lensUV(vUv, m, rN);
    cur = texture(uScene, s).rgb * m + texture(uFront, vUv).rgb;
    float ring = exp(-pow((rN - 1.07) / 0.045, 2.0)) + 0.25 * exp(-pow((rN - 1.07) / 0.18, 2.0));
    cur += uRing.rgb * uRing.w * ring;
  } else {
    cur = texture(uScene, vUv).rgb;
  }
  vec3 prev = vec3(0.0);
  if (uDecay > 0.001) {
    vec2 c = vUv - 0.5 - uWarp.zw;
    float cs = cos(uWarp.y), sn = sin(uWarp.y);
    c = mat2(cs, -sn, sn, cs) * c / uWarp.x;
    prev = texture(uPrev, c + 0.5).rgb;
    if (any(isnan(prev))) prev = vec3(0.0);
  }
  o = vec4(min(cur * uComp + prev * uDecay, vec3(30000.0)), 1.0);
}`;

const BG_FS = HEADER + CONST + RNG + NOISE + LENS + `
in vec2 vUv;
uniform sampler2D uAccum;
uniform mat4 uInvVP;
uniform vec3 uCamPos;
uniform float uPixelAngle;
uniform float uStars;
uniform float uHaze;
uniform float uHazeScale;
uniform vec3 uHazeA;
uniform vec3 uHazeB;
uniform vec3 uBgTop;
uniform vec3 uBgBottom;
uniform vec3 uGlowDir;
uniform vec3 uGlowColor;
uniform vec2 uGlow; // amount, angular size
uniform float uTime;
uniform float uBgPulse;
out vec4 o;
vec3 rayDir(vec2 uv) {
  vec4 w = uInvVP * vec4(uv * 2.0 - 1.0, 1.0, 1.0);
  return normalize(w.xyz / w.w - uCamPos);
}
vec3 starLayer(vec3 dir, float scale, float density, float bright) {
  vec3 p = dir * scale;
  vec3 cell = floor(p);
  float h = hash13(cell + 17.0);
  if (h > density) return vec3(0.0);
  vec3 sp = cell + 0.3 + 0.4 * hash33(cell);
  vec3 sd = normalize(sp);
  float a2 = max(0.0, 2.0 * (1.0 - dot(sd, dir)));
  float sig = uPixelAngle * 0.7;
  float k = exp(-a2 / (2.0 * sig * sig));
  float m = hash13(cell * 1.7 + 3.1);
  float mag = 0.25 + 5.0 * pow(m, 8.0);
  float tw = 0.8 + 0.2 * sin(uTime * (1.5 + 3.0 * h) + h * 400.0);
  vec3 tint = mix(vec3(0.62, 0.74, 1.0), vec3(1.0, 0.82, 0.62), hash13(cell + 9.0));
  return tint * k * mag * tw * bright;
}
void main() {
  vec2 uv = vUv;
  float mask = 1.0, rN = 0.0;
  vec2 suv = uv;
  if (uLensAmt > 0.001) suv = lensUV(uv, mask, rN);
  vec3 dir = rayDir(suv);
  vec3 col = mix(uBgBottom, uBgTop, smoothstep(-0.6, 0.8, dir.y));
  if (uHaze > 0.001) {
    float n = fbm3(dir * uHazeScale + vec3(0.0, uTime * 0.004, 0.0));
    float m = fbm3(dir * uHazeScale * 2.3 + vec3(5.2, 1.3, -uTime * 0.003));
    float d = smoothstep(-0.15, 0.7, n) * (0.6 + 0.4 * m);
    col += mix(uHazeA, uHazeB, smoothstep(-0.4, 0.6, m)) * d * d * uHaze * (1.0 + uBgPulse);
  }
  if (uStars > 0.001) {
    col += starLayer(dir, 24.0, 0.3, 0.55 * uStars);
    col += starLayer(dir.zxy, 52.0, 0.16, 0.22 * uStars);
    col += starLayer(dir.yzx, 110.0, 0.08, 0.12 * uStars);
  }
  if (uGlow.x > 0.001) {
    float a2 = max(0.0, 2.0 * (1.0 - dot(dir, normalize(uGlowDir))));
    col += uGlowColor * uGlow.x * (exp(-a2 / (uGlow.y * uGlow.y)) + 0.15 * exp(-a2 / (16.0 * uGlow.y * uGlow.y)));
  }
  o = vec4(texture(uAccum, uv).rgb + col * mask, 1.0);
}`;

const DOWN_FS = HEADER + `
in vec2 vUv;
uniform sampler2D uSrc;
uniform vec2 uTexel;
uniform vec3 uThresh; // threshold, knee, prefilter on/off
out vec4 o;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 karis(vec3 a, vec3 b, vec3 c, vec3 d) {
  float wa = 1.0 / (1.0 + luma(a)), wb = 1.0 / (1.0 + luma(b)), wc = 1.0 / (1.0 + luma(c)), wd = 1.0 / (1.0 + luma(d));
  return (a * wa + b * wb + c * wc + d * wd) / (wa + wb + wc + wd);
}
vec3 prefilter(vec3 c) {
  float br = max(c.r, max(c.g, c.b));
  float soft = clamp(br - uThresh.x + uThresh.y, 0.0, 2.0 * uThresh.y);
  soft = soft * soft / (4.0 * uThresh.y + 1e-4);
  return c * max(soft, br - uThresh.x) / max(br, 1e-4);
}
vec3 tap(vec2 o2) { return texture(uSrc, vUv + uTexel * o2).rgb; }
void main() {
  vec3 a = tap(vec2(-2.0, 2.0)), b = tap(vec2(0.0, 2.0)), c = tap(vec2(2.0, 2.0));
  vec3 d = tap(vec2(-2.0, 0.0)), e = tap(vec2(0.0)), f = tap(vec2(2.0, 0.0));
  vec3 g = tap(vec2(-2.0, -2.0)), h = tap(vec2(0.0, -2.0)), i = tap(vec2(2.0, -2.0));
  vec3 j = tap(vec2(-1.0, 1.0)), k = tap(vec2(1.0, 1.0)), l = tap(vec2(-1.0, -1.0)), m = tap(vec2(1.0, -1.0));
  vec3 r;
  if (uThresh.z > 0.5) {
    r = karis(j, k, l, m) * 0.5 + karis(a, b, d, e) * 0.125 + karis(b, c, e, f) * 0.125 + karis(d, e, g, h) * 0.125 + karis(e, f, h, i) * 0.125;
    r = prefilter(r);
  } else {
    r = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  }
  o = vec4(max(r, 0.0), 1.0);
}`;

const UP_FS = HEADER + `
in vec2 vUv;
uniform sampler2D uSrc;
uniform vec2 uTexel;
uniform float uRadius;
uniform float uWeight;
out vec4 o;
void main() {
  vec2 t = uTexel * uRadius;
  vec3 s = texture(uSrc, vUv + vec2(-t.x, t.y)).rgb + 2.0 * texture(uSrc, vUv + vec2(0.0, t.y)).rgb + texture(uSrc, vUv + t).rgb
    + 2.0 * texture(uSrc, vUv + vec2(-t.x, 0.0)).rgb + 4.0 * texture(uSrc, vUv).rgb + 2.0 * texture(uSrc, vUv + vec2(t.x, 0.0)).rgb
    + texture(uSrc, vUv - t).rgb + 2.0 * texture(uSrc, vUv + vec2(0.0, -t.y)).rgb + texture(uSrc, vUv + vec2(t.x, -t.y)).rgb;
  o = vec4(s * (uWeight / 16.0), 1.0);
}`;

const FLARE_PRE_FS = HEADER + `
in vec2 vUv;
uniform sampler2D uSrc;
uniform float uThreshold;
out vec4 o;
void main() {
  vec3 c = texture(uSrc, vUv).rgb;
  float br = max(c.r, max(c.g, c.b));
  o = vec4(c * max(0.0, br - uThreshold) / max(br, 1e-4), 1.0);
}`;

const FLARE_BLUR_FS = HEADER + `
in vec2 vUv;
uniform sampler2D uSrc;
uniform vec2 uStep;
out vec4 o;
void main() {
  vec3 s = texture(uSrc, vUv).rgb * 0.227;
  s += (texture(uSrc, vUv + uStep).rgb + texture(uSrc, vUv - uStep).rgb) * 0.1945;
  s += (texture(uSrc, vUv + uStep * 2.0).rgb + texture(uSrc, vUv - uStep * 2.0).rgb) * 0.1216;
  s += (texture(uSrc, vUv + uStep * 3.0).rgb + texture(uSrc, vUv - uStep * 3.0).rgb) * 0.054;
  s += (texture(uSrc, vUv + uStep * 4.0).rgb + texture(uSrc, vUv - uStep * 4.0).rgb) * 0.0162;
  o = vec4(s * 1.0, 1.0);
}`;

const COMPOSITE_FS = HEADER + RNG + ACES + `
in vec2 vUv;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform sampler2D uFlare;
uniform vec2 uRes;
uniform float uExposure;
uniform float uBloomStr;
uniform float uFlareStr;
uniform vec3 uFlareTint;
uniform float uCA;
uniform float uVignette;
uniform float uGrain;
uniform float uSat;
uniform float uContrast;
uniform float uHue;
uniform float uTemp;
uniform float uLetterbox;
uniform float uTime;
uniform float uFlash;
uniform vec3 uFlashColor;
uniform float uFade;
uniform float uBlack;
out vec4 o;
vec3 hueRotate(vec3 c, float a) {
  const mat3 toYIQ = mat3(0.299, 0.596, 0.211, 0.587, -0.274, -0.523, 0.114, -0.322, 0.312);
  const mat3 toRGB = mat3(1.0, 1.0, 1.0, 0.956, -0.272, -1.106, 0.621, -0.647, 1.703);
  vec3 yiq = toYIQ * c;
  float cs = cos(a), sn = sin(a);
  yiq.yz = mat2(cs, sn, -sn, cs) * yiq.yz;
  return toRGB * yiq;
}
void main() {
  vec2 uv = vUv;
  vec2 d = uv - 0.5;
  float r2 = dot(d * vec2(uRes.x / uRes.y, 1.0), d * vec2(uRes.x / uRes.y, 1.0));
  vec2 caOff = d * uCA * 0.008 * (0.05 + r2 * 1.6);
  vec3 col;
  col.r = texture(uScene, uv - caOff).r;
  col.g = texture(uScene, uv).g;
  col.b = texture(uScene, uv + caOff).b;
  vec3 bl;
  bl.r = texture(uBloom, uv - caOff * 2.0).r;
  bl.g = texture(uBloom, uv).g;
  bl.b = texture(uBloom, uv + caOff * 2.0).b;
  col += bl * uBloomStr;
  col += texture(uFlare, uv).rgb * uFlareTint * uFlareStr;
  col += uFlashColor * uFlash;
  col *= uExposure * vec3(1.0 + uTemp * 0.12, 1.0 + uTemp * 0.02, 1.0 - uTemp * 0.12);
  col = max(col - uBlack, 0.0) * (1.0 + uBlack * 4.0);
  if (abs(uHue) > 0.001) col = max(hueRotate(col, uHue), 0.0);
  col = acesFitted(col);
  col = pow(col, vec3(1.0 / 2.2));
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(l), col, uSat);
  col = clamp((col - 0.5) * uContrast + 0.5, 0.0, 1.0);
  float vig = smoothstep(1.25, 0.25, sqrt(r2) * 1.25);
  col *= mix(1.0, vig, uVignette);
  float n = hash12(uv * uRes + fract(uTime * 13.7) * 1000.0) - 0.5;
  col *= 1.0 + n * uGrain * 0.22;
  col += n * uGrain * 0.006;
  col = max(col, 0.0);
  col += (hash12(uv * uRes * 1.37 + 0.71) - 0.5) / 255.0;
  float bar = uLetterbox;
  if (bar > 0.0) {
    float e = abs(uv.y - 0.5) * 2.0;
    col *= 1.0 - smoothstep(1.0 - bar * 2.0 - 0.002, 1.0 - bar * 2.0, e);
  }
  o = vec4(col * uFade, 1.0);
}`;

export class PostFX {
  constructor(gl) {
    this.gl = gl;
    this.vao = gl.createVertexArray();
    this.trailProg = new Program(gl, FULLSCREEN_VS, TRAIL_FS, 'trail');
    this.bgProg = new Program(gl, FULLSCREEN_VS, BG_FS, 'background');
    this.downProg = new Program(gl, FULLSCREEN_VS, DOWN_FS, 'bloom-down');
    this.upProg = new Program(gl, FULLSCREEN_VS, UP_FS, 'bloom-up');
    this.flarePreProg = new Program(gl, FULLSCREEN_VS, FLARE_PRE_FS, 'flare-pre');
    this.flareBlurProg = new Program(gl, FULLSCREEN_VS, FLARE_BLUR_FS, 'flare-blur');
    this.compProg = new Program(gl, FULLSCREEN_VS, COMPOSITE_FS, 'composite');
    this.w = 0; this.h = 0;
    this.accIdx = 0;
    this.split = false;
  }

  resize(w, h) {
    w = Math.max(16, w | 0); h = Math.max(16, h | 0);
    if (w === this.w && h === this.h) return;
    this.w = w; this.h = h;
    const gl = this.gl;
    const mk = (W, H) => new Texture(gl, W, H, 'rgba16f');
    if (!this.scene) {
      this.sceneTex = mk(w, h);
      this.frontTex = mk(w, h);
      this.scene = new Target(gl, [this.sceneTex]);
      this.sceneSplit = new Target(gl, [this.sceneTex, this.frontTex]);
      this.front = new Target(gl, [this.frontTex]);
      this.acc = [new Target(gl, [mk(w, h)]), new Target(gl, [mk(w, h)])];
      this.comb = new Target(gl, [mk(w, h)]);
    } else {
      this.sceneTex.resize(w, h); this.frontTex.resize(w, h);
      this.scene.attach(); this.sceneSplit.attach(); this.front.attach();
      this.acc.forEach((t) => t.resize(w, h));
      this.comb.resize(w, h);
      this.mips.forEach((t) => t.dispose());
      this.flareT.forEach((t) => t.dispose());
    }
    this.mips = [];
    let mw = w >> 1, mh = h >> 1;
    while (this.mips.length < 7 && mw >= 8 && mh >= 8) {
      this.mips.push(new Target(gl, [mk(mw, mh)]));
      mw >>= 1; mh >>= 1;
    }
    const fl = this.mips[Math.min(2, this.mips.length - 1)];
    this.flareT = [new Target(gl, [mk(fl.w, fl.h)]), new Target(gl, [mk(fl.w, fl.h)])];
    this.clearAccum();
  }

  clearAccum() {
    const gl = this.gl;
    for (const t of this.acc) { t.bind(); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT); }
  }

  _draw() {
    const gl = this.gl;
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  beginParticles(split) {
    const gl = this.gl;
    this.split = split;
    if (split) {
      this.front.bind(); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    }
    this.scene.bind();
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (split) this.sceneSplit.bind();
    gl.enable(gl.BLEND);
    gl.blendEquation(gl.FUNC_ADD);
    gl.blendFunc(gl.ONE, gl.ONE);
  }

  endParticles() { this.gl.disable(this.gl.BLEND); }

  // particles (+lens) + decayed history → accumulation buffer
  accumulate(u) {
    const gl = this.gl;
    const prev = this.acc[this.accIdx];
    this.accIdx ^= 1;
    const dst = this.acc[this.accIdx];
    dst.bind();
    gl.disable(gl.BLEND);
    const p = this.trailProg.use();
    p.set('uScene', this.sceneTex).set('uFront', this.frontTex).set('uPrev', prev.textures[0]);
    p.setAll(u);
    p.set('uAspect', this.w / this.h);
    this._draw();
  }

  get accum() { return this.acc[this.accIdx]; }

  background(u) {
    const gl = this.gl;
    this.comb.bind();
    const p = this.bgProg.use();
    p.set('uAccum', this.accum.textures[0]);
    p.setAll(u);
    p.set('uAspect', this.w / this.h);
    this._draw();
  }

  bloom({ threshold = 0, knee = 0.5, radius = 0.6 }) {
    const gl = this.gl;
    gl.disable(gl.BLEND);
    let src = this.comb.textures[0];
    const dp = this.downProg.use();
    for (let i = 0; i < this.mips.length; i++) {
      const m = this.mips[i];
      m.bind();
      dp.set('uSrc', src).set('uTexel', [1 / src.w, 1 / src.h]).set('uThresh', [threshold, Math.max(1e-3, knee), i === 0 ? 1 : 0]);
      this._draw();
      src = m.textures[0];
    }
    const up = this.upProg.use();
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    for (let i = this.mips.length - 1; i > 0; i--) {
      const s = this.mips[i].textures[0];
      this.mips[i - 1].bind();
      up.set('uSrc', s).set('uTexel', [1 / s.w, 1 / s.h]).set('uRadius', 1.0).set('uWeight', radius);
      this._draw();
    }
    gl.disable(gl.BLEND);
    return this.mips[0].textures[0];
  }

  flare(threshold) {
    const gl = this.gl;
    const srcMip = this.mips[Math.min(1, this.mips.length - 1)];
    const [a, b] = this.flareT;
    a.bind();
    this.flarePreProg.use().set('uSrc', srcMip.textures[0]).set('uThreshold', threshold);
    this._draw();
    const bp = this.flareBlurProg.use();
    const steps = [1.5, 5, 15, 40];
    let src = a, dst = b;
    for (const s of steps) {
      dst.bind();
      bp.set('uSrc', src.textures[0]).set('uStep', [s / a.w, 0]);
      this._draw();
      [src, dst] = [dst, src];
    }
    return src.textures[0];
  }

  composite(u, outW, outH, bloomTex, flareTex) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, outW, outH);
    gl.disable(gl.BLEND);
    const p = this.compProg.use();
    p.set('uScene', this.comb.textures[0]).set('uBloom', bloomTex).set('uFlare', flareTex);
    p.set('uRes', [outW, outH]);
    p.setAll(u);
    this._draw();
  }

  get bytes() {
    let b = this.w * this.h * 8 * 6;
    for (const m of this.mips) b += m.w * m.h * 8;
    return b;
  }
}
