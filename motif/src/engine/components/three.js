// 3D components (Three.js): globe, bars3d, surface, particles, shape3d, model, molecule.
// Each instance builds its scene lazily on first draw, updates it as a pure function of t,
// renders through the shared WebGL stage and overlays 2D labels with the theme typography.
import { THREE, renderInto, project, environment, dotTexture, isSoftwareGL } from '../three/stage.js';
import { landDots, toLatLon } from '../three/geo.js';
import { moleculePreset, ELEMENTS } from '../three/molecules.js';
import { role, toCss, EASE, clamp01, colorOf, mix, drawIcon, roundRect } from './kit.js';
import { fontString } from '../text/text.js';
import { compileExpr } from '../../core/expr.js';
import { rng } from '../../core/util/misc.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const TAU = Math.PI * 2;
const C3 = (c) => new THREE.Color(c);

function fallback(ctx, c, rect, msg = '3D 需要 WebGL') {
  const { p, env } = c;
  ctx.save();
  ctx.strokeStyle = p.softLine; ctx.setLineDash([8 * env.unit, 8 * env.unit]); ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  drawIcon(ctx, 'box', rect.x + rect.w / 2, rect.y + rect.h / 2 - env.sizes.body, env.sizes.h2, p.mutedText);
  ctx.font = fontString(role(env, 'text'), env.sizes.small); ctx.fillStyle = p.mutedText; ctx.textAlign = 'center';
  ctx.fillText(msg, rect.x + rect.w / 2, rect.y + rect.h / 2 + env.sizes.body);
  ctx.restore();
}

function label2d(ctx, c, text, x, y, o = {}) {
  const { env, p } = c;
  const fs = o.size || env.sizes.small;
  ctx.save();
  ctx.font = fontString(role(env, 'text', { weight: o.weight || 600 }), fs);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  ctx.textAlign = o.align || 'left'; ctx.textBaseline = 'middle';
  if (o.plate) {
    const w = ctx.measureText(text).width;
    const bx = o.align === 'center' ? x - w / 2 - fs * 0.5 : x - fs * 0.5;
    ctx.fillStyle = toCss(p.bg, 0.72); roundRect(ctx, bx, y - fs * 0.8, w + fs, fs * 1.6, fs * 0.4); ctx.fill();
  }
  ctx.globalAlpha *= o.alpha ?? 1;
  ctx.fillStyle = o.color || p.ink;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function lights(scene, p, o = {}) {
  scene.add(new THREE.HemisphereLight(C3(mix(p.ink, '#ffffff', 0.5)), C3(p.bg), o.hemi ?? 1.1));
  const key = new THREE.DirectionalLight(C3(mix('#ffffff', p.accent, 0.15)), o.key ?? 2.2);
  key.position.set(4, 6, 5); scene.add(key);
  const rim = new THREE.DirectionalLight(C3(p.accent2 || p.accent), o.rim ?? 1.4);
  rim.position.set(-5, 2, -4); scene.add(rim);
}

function lazy(make) {
  let S = null;
  return () => (S ||= make());
}

const latLonVec = (lat, lon, r = 1) => {
  const la = (lat * Math.PI) / 180, lo = (lon * Math.PI) / 180;
  return new THREE.Vector3(Math.cos(la) * Math.sin(lo) * r, Math.sin(la) * r, Math.cos(la) * Math.cos(lo) * r);
};

// ───────────────────────────── globe ─────────────────────────────
const globe = {
  type: 'globe',
  measure(block, c, w, maxH) { return { h: Math.min(maxH, w * 0.9), fill: true }; },
  build(block, c, rect) {
    const { env, p } = c;
    const T = env.motion.tempo;
    const pts = (block.points || []).map((v) => ({ ll: toLatLon(v), label: typeof v === 'string' ? v : v.label ?? v.name ?? v.city, value: v.value })).filter((x) => x.ll);
    const arcs = (block.arcs || []).map((a) => ({ from: toLatLon(a.from ?? a[0]), to: toLatLon(a.to ?? a[1]) })).filter((a) => a.from && a.to);
    const focus = toLatLon(block.focus) || pts[0]?.ll || [20, 100];
    const spin = block.spin ?? 1;
    const style = block.style && block.style !== 'auto' ? block.style : 'dots';
    const backdrop = !!(c.hint?.backdrop || c.hint?.bleed);
    const S = lazy(() => {
      const scene = new THREE.Scene();
      const group = new THREE.Group(); scene.add(group);
      const baseCol = p.dark ? mix(p.bg, p.accent, 0.08) : mix(p.bg, p.ink, 0.06);
      group.add(new THREE.Mesh(new THREE.SphereGeometry(0.995, 72, 48), new THREE.MeshBasicMaterial({ color: C3(baseCol) })));
      if (style === 'wire') {
        const mat = new THREE.LineBasicMaterial({ color: C3(p.softLine.startsWith('rgba') ? mix(p.ink, p.bg, 0.6) : p.softLine), transparent: true, opacity: 0.5 });
        for (let lat = -75; lat <= 75; lat += 15) { const g = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 121 }, (_, i) => latLonVec(lat, -180 + i * 3, 1.001))); group.add(new THREE.Line(g, mat)); }
        for (let lon = -180; lon < 180; lon += 15) { const g = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 61 }, (_, i) => latLonVec(-90 + i * 3, lon, 1.001))); group.add(new THREE.Line(g, mat)); }
      }
      const dots = landDots(style === 'solid' ? 0.9 : 1.35);
      const pos = new Float32Array(dots.length * 3);
      dots.forEach(([la, lo], i) => { const v = latLonVec(la, lo, 1.003); pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z; });
      const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const dm = new THREE.PointsMaterial({ size: style === 'solid' ? 0.03 : 0.022, map: dotTexture(), transparent: true, depthWrite: false, color: C3(p.dark ? mix(p.ink, p.accent, 0.25) : mix(p.ink, p.bg, 0.25)), opacity: p.dark ? 0.85 : 0.75, sizeAttenuation: true });
      group.add(new THREE.Points(dg, dm));
      // atmosphere glow (fresnel)
      const atm = new THREE.Mesh(new THREE.SphereGeometry(1.16, 64, 48), new THREE.ShaderMaterial({
        uniforms: { c: { value: C3(p.accent) }, k: { value: p.dark ? 1.0 : 0.6 } },
        vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
        fragmentShader: 'uniform vec3 c; uniform float k; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 3.0); float edge = smoothstep(0.0, 0.35, abs(dot(vN, vV))); gl_FragColor = vec4(c, f * edge * k); }',
        side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      scene.add(atm);
      const markers = pts.map((pt, i) => {
        const v = latLonVec(pt.ll[0], pt.ll[1], 1.006);
        const col = C3(i === 0 ? p.accent : p.data[(i + 1) % p.data.length]);
        const m = new THREE.Mesh(new THREE.CircleGeometry(0.022, 24), new THREE.MeshBasicMaterial({ color: col, transparent: true, side: THREE.DoubleSide }));
        m.position.copy(v); m.lookAt(v.clone().multiplyScalar(2));
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.03, 0.038, 40), new THREE.MeshBasicMaterial({ color: col, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
        ring.position.copy(v); ring.lookAt(v.clone().multiplyScalar(2));
        group.add(m, ring);
        return { m, ring, v, pt };
      });
      const arcObjs = arcs.map((a, i) => {
        const A = latLonVec(a.from[0], a.from[1]), B = latLonVec(a.to[0], a.to[1]);
        const ang = A.angleTo(B);
        const h = 0.12 + 0.38 * (ang / Math.PI);
        const N = 96;
        const ptsA = [];
        for (let k = 0; k <= N; k++) {
          const u = k / N;
          const v = new THREE.Vector3().copy(A).lerp(B, u).normalize();
          ptsA.push(v.multiplyScalar(1 + h * Math.sin(Math.PI * u)));
        }
        const curve = new THREE.CatmullRomCurve3(ptsA);
        const geo = new THREE.TubeGeometry(curve, 128, 0.0055, 6, false);
        const mat = new THREE.MeshBasicMaterial({ color: C3(p.data[i % p.data.length] === p.bg ? p.accent : i === 0 ? p.accent : p.data[i % p.data.length]), transparent: true, opacity: 0.95, blending: p.dark ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: false });
        const mesh = new THREE.Mesh(geo, mat);
        group.add(mesh);
        const pulse = new THREE.Mesh(new THREE.SphereGeometry(0.014, 12, 12), new THREE.MeshBasicMaterial({ color: C3(mix(p.accent, '#ffffff', 0.5)) }));
        group.add(pulse);
        return { mesh, geo, curve, pulse, count: geo.index.count };
      });
      const camera = new THREE.PerspectiveCamera(30, rect.w / rect.h, 0.1, 50);
      return { scene, group, camera, markers, arcObjs };
    });
    const intro = 2.2 * T;
    const arcStart = 1.0 * T, arcPer = 0.45 * T, arcDur = 1.3 * T;
    return {
      duration: arcStart + arcPer * Math.max(0, arcs.length - 1) + arcDur, hold: 4,
      draw(ctx, t) {
        const s = S();
        const { group, camera } = s;
        const e = EASE.inOutCubic(clamp01(t / intro));
        const lon0 = (-focus[1] * Math.PI) / 180;
        group.rotation.y = lon0 - (1 - e) * 1.1 + Math.max(0, t - intro) * 0.06 * spin;
        group.rotation.x = ((focus[0] * Math.PI) / 180) * 0.75 * e + (1 - e) * 0.25;
        const fit = Math.min(1, rect.w / rect.h);
        // As a cover backdrop the globe rises from the bottom like a planet horizon.
        const horizon = backdrop && rect.w > rect.h;
        const dist = (horizon ? 2.55 : 4.0) / Math.max(0.55, fit) + (1 - e) * 1.2;
        group.position.y = horizon ? -1.28 + (1 - e) * -0.4 : 0;
        camera.position.set(0, 0, dist);
        camera.lookAt(0, 0, 0);
        const sc = 0.82 + 0.18 * EASE.outCubic(clamp01(t / (intro * 0.8)));
        group.scale.setScalar(sc);
        s.markers.forEach((mk, i) => {
          const k = clamp01((t - 0.8 * T - i * 0.12) / 0.5);
          mk.m.scale.setScalar(EASE.outBack(k) || 0.0001);
          const ph = ((t * 0.7 + i * 0.37) % 1);
          mk.ring.scale.setScalar(k > 0 ? 1 + ph * 2.2 : 0.0001);
          mk.ring.material.opacity = k * (1 - ph) * 0.9;
        });
        s.arcObjs.forEach((a, i) => {
          const u = EASE.inOutCubic(clamp01((t - arcStart - i * arcPer) / arcDur));
          a.geo.setDrawRange(0, Math.floor((a.count * u) / 6) * 6);
          a.mesh.visible = u > 0;
          const q = u >= 1 ? ((t - arcStart - i * arcPer - arcDur) * 0.5) % 1 : u;
          a.pulse.visible = u > 0;
          a.pulse.position.copy(a.curve.getPointAt(Math.min(0.999, Math.max(0, q))));
        });
        ctx.save();
        ctx.globalAlpha *= EASE.outQuad(clamp01(t / 0.6));
        if (!renderInto(ctx, s.scene, camera, rect)) { ctx.restore(); return fallback(ctx, c, rect); }
        ctx.restore();
        // labels for front-facing markers
        group.updateMatrixWorld(true);
        const camDir = new THREE.Vector3().copy(camera.position).normalize();
        s.markers.forEach((mk, i) => {
          if (!mk.pt.label) return;
          const wp = mk.v.clone().applyMatrix4(group.matrixWorld);
          const facing = wp.clone().normalize().dot(camDir);
          const k = clamp01((t - 1.0 * T - i * 0.12) / 0.5) * clamp01((facing - 0.15) / 0.2);
          if (k <= 0) return;
          const q = project(wp, camera, rect);
          label2d(ctx, c, String(mk.pt.label), q.x + env.sizes.small * 0.6, q.y - env.sizes.small * 0.7, { alpha: k, plate: true, size: env.sizes.small * 0.9 });
        });
      },
    };
  },
};

// ───────────────────────────── bars3d ─────────────────────────────
const bars3d = {
  type: 'bars3d',
  measure(block, c, w, maxH) { return { h: Math.min(maxH, w * 0.7), fill: true }; },
  build(block, c, rect) {
    const { env, p } = c;
    const T = env.motion.tempo;
    const d = block.data || { labels: [], series: [] };
    const labels = d.labels || [];
    const series = d.series || [];
    const nx = labels.length, nz = Math.max(1, series.length);
    const max = Math.max(1e-9, ...series.flatMap((s) => s.values.map((v) => v || 0)));
    const H = 3.2;
    const S = lazy(() => {
      const scene = new THREE.Scene();
      lights(scene, p);
      const env3 = environment();
      const bars = [];
      const geo = new THREE.BoxGeometry(0.66, 1, 0.66);
      geo.translate(0, 0.5, 0);
      series.forEach((s, j) => {
        const mat = new THREE.MeshStandardMaterial({ color: C3(p.data[j % p.data.length]), roughness: 0.42, metalness: 0.15, envMap: env3, envMapIntensity: 0.6 });
        s.values.forEach((v, i) => {
          const m = new THREE.Mesh(geo, mat);
          m.position.set(i - (nx - 1) / 2, 0, j - (nz - 1) / 2);
          scene.add(m);
          bars.push({ m, h: ((v || 0) / max) * H, i, j, v });
        });
      });
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(nx + 1.2, nz + 1.2), new THREE.MeshStandardMaterial({ color: C3(mix(p.bg, p.ink, 0.06)), roughness: 1 }));
      floor.rotation.x = -Math.PI / 2; floor.position.y = -0.001; scene.add(floor);
      const grid = new THREE.GridHelper(Math.max(nx, nz) + 1, Math.max(nx, nz) + 1, C3(mix(p.bg, p.ink, 0.25)), C3(mix(p.bg, p.ink, 0.15)));
      grid.position.y = 0.002; scene.add(grid);
      const camera = new THREE.PerspectiveCamera(32, rect.w / rect.h, 0.1, 100);
      return { scene, bars, camera };
    });
    const per = Math.min(0.08, 1.4 / Math.max(1, nx * nz)) * T;
    return {
      duration: 0.4 + per * nx * nz + 0.9 * T, hold: 3,
      draw(ctx, t) {
        const s = S();
        const R = Math.max(nx, nz) * 1.25 + 4;
        const ang = -0.75 + t * 0.07;
        s.camera.position.set(Math.sin(ang) * R, R * 0.62, Math.cos(ang) * R);
        s.camera.lookAt(0, H * 0.35, 0);
        s.bars.forEach((b, k) => {
          const e = env.motion.ease(clamp01((t - 0.3 - (b.i * nz + b.j) * per) / (0.9 * T)));
          b.m.scale.set(1, Math.max(0.0001, b.h * e), 1);
        });
        ctx.save(); ctx.globalAlpha *= clamp01(t / 0.4);
        if (!renderInto(ctx, s.scene, s.camera, rect)) { ctx.restore(); return fallback(ctx, c, rect); }
        ctx.restore();
        const a = clamp01((t - 0.5) / 0.6);
        labels.forEach((l, i) => { const q = project(new THREE.Vector3(i - (nx - 1) / 2, 0, (nz - 1) / 2 + 0.9), s.camera, rect); label2d(ctx, c, String(l), q.x, q.y, { align: 'center', alpha: a, size: env.sizes.caption * 1.1, color: p.mutedText }); });
        if (nz > 1) series.forEach((sr, j) => { const q = project(new THREE.Vector3((nx - 1) / 2 + 1.4, 0, j - (nz - 1) / 2), s.camera, rect); label2d(ctx, c, sr.name, q.x, q.y, { alpha: a, size: env.sizes.caption * 1.1, color: p.data[j % p.data.length] }); });
        const done = clamp01((t - 0.4 - per * nx * nz - 0.6) / 0.5);
        if (done > 0) {
          const top = s.bars.reduce((m, b) => (b.h > m.h ? b : m), s.bars[0]);
          if (top) { const q = project(new THREE.Vector3(top.m.position.x, top.h + 0.25, top.m.position.z), s.camera, rect); label2d(ctx, c, `${block.prefix || ''}${top.v}${block.suffix || ''}`, q.x, q.y, { align: 'center', alpha: done, plate: true }); }
        }
      },
    };
  },
};

// ───────────────────────────── surface ─────────────────────────────
const surface = {
  type: 'surface',
  measure(block, c, w, maxH) { return { h: Math.min(maxH, w * 0.7), fill: true }; },
  build(block, c, rect) {
    const { env, p } = c;
    const T = env.motion.tempo;
    let fn;
    const issues = [];
    try { fn = compileExpr(block.expr || 'sin(x)*cos(y)').fn; } catch (e) { issues.push({ level: 'error', message: e.message }); fn = () => 0; }
    const [r0, r1] = Array.isArray(block.range) ? block.range : [-3, 3];
    const N = 110;
    const S = lazy(() => {
      const scene = new THREE.Scene();
      lights(scene, p, { hemi: 0.75, key: 1.8, rim: 0.9 });
      const geo = new THREE.PlaneGeometry(6, 6, N, N);
      geo.rotateX(-Math.PI / 2);
      const base = geo.attributes.position.array.slice();
      const colors = new Float32Array(base.length);
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      const mat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.55, metalness: 0.05, envMap: environment(), envMapIntensity: 0.4 });
      const mesh = new THREE.Mesh(geo, mat);
      const wire = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.PlaneGeometry(6, 6, 22, 22)), new THREE.LineBasicMaterial({ color: C3(p.ink), transparent: true, opacity: 0.0 }));
      scene.add(mesh);
      mesh.add(new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.PlaneGeometry(6, 6, 30, 30).rotateX(-Math.PI / 2)), new THREE.LineBasicMaterial({ color: C3(p.ink), transparent: true, opacity: 0 })));
      const camera = new THREE.PerspectiveCamera(34, rect.w / rect.h, 0.1, 100);
      // evaluate once to find z range
      const sc = { x: 0, y: 0, t: 0 };
      let zmin = Infinity, zmax = -Infinity;
      for (let k = 0; k < base.length; k += 3) { sc.x = r0 + ((base[k] + 3) / 6) * (r1 - r0); sc.y = r0 + ((base[k + 2] + 3) / 6) * (r1 - r0); const z = fn(sc); if (Number.isFinite(z)) { zmin = Math.min(zmin, z); zmax = Math.max(zmax, z); } }
      const ramp = [C3(p.accent2 || p.data[1]), C3(p.accent), C3(p.accent3 || p.data[2] || p.accent)];
      return { scene, mesh, geo, base, colors, camera, zmin, zmax, ramp, wire };
    });
    return {
      duration: 2.2 * T, hold: 4, issues,
      draw(ctx, t) {
        const s = S();
        const e = EASE.inOutCubic(clamp01(t / (1.8 * T)));
        const pos = s.geo.attributes.position.array;
        const sc = { x: 0, y: 0, t: block.animate ? t : 0 };
        const span = s.zmax - s.zmin || 1;
        const hScale = 2.2 / span;
        const tmp = new THREE.Color();
        for (let k = 0; k < pos.length; k += 3) {
          sc.x = r0 + ((s.base[k] + 3) / 6) * (r1 - r0); sc.y = r0 + ((s.base[k + 2] + 3) / 6) * (r1 - r0);
          let z = fn(sc); if (!Number.isFinite(z)) z = 0;
          pos[k + 1] = (z - (s.zmin + s.zmax) / 2) * hScale * e;
          const u = clamp01((z - s.zmin) / span);
          if (u < 0.5) tmp.copy(s.ramp[0]).lerp(s.ramp[1], u * 2); else tmp.copy(s.ramp[1]).lerp(s.ramp[2], (u - 0.5) * 2);
          s.colors[k] = tmp.r; s.colors[k + 1] = tmp.g; s.colors[k + 2] = tmp.b;
        }
        s.geo.attributes.position.needsUpdate = true; s.geo.attributes.color.needsUpdate = true;
        s.geo.computeVertexNormals();
        const ang = 0.7 + t * 0.09;
        s.camera.position.set(Math.sin(ang) * 8.2, 5.4, Math.cos(ang) * 8.2);
        s.camera.lookAt(0, 0, 0);
        ctx.save(); ctx.globalAlpha *= clamp01(t / 0.4);
        if (!renderInto(ctx, s.scene, s.camera, rect)) { ctx.restore(); return fallback(ctx, c, rect); }
        ctx.restore();
      },
    };
  },
};

// ───────────────────────────── particles ─────────────────────────────
function textPoints(text, fontFamily, n) {
  const c = document.createElement('canvas');
  c.width = 1200; c.height = 300;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  let size = 240;
  g.font = `800 ${size}px ${fontFamily}`;
  while (g.measureText(text).width > 1120 && size > 40) { size -= 10; g.font = `800 ${size}px ${fontFamily}`; }
  g.fillText(text, 600, 150);
  const data = g.getImageData(0, 0, 1200, 300).data;
  const cand = [];
  for (let y = 0; y < 300; y += 3) for (let x = 0; x < 1200; x += 3) if (data[(y * 1200 + x) * 4 + 3] > 128) cand.push([(x - 600) / 150, -(y - 150) / 150]);
  const r = rng('tp' + text);
  return Array.from({ length: n }, () => { const q = cand[Math.floor(r() * cand.length)] || [0, 0]; return [q[0] + (r() - 0.5) * 0.02, q[1] + (r() - 0.5) * 0.02, (r() - 0.5) * 0.15]; });
}

const particles = {
  type: 'particles',
  measure(block, c, w, maxH) { return { h: Math.min(maxH, w * 0.6), fill: true }; },
  build(block, c, rect) {
    const { env, p } = c;
    const T = env.motion.tempo;
    const shape = block.shape || 'galaxy';
    const n = Math.min(20000, Math.max(500, block.count || (shape === 'text' ? 7000 : 9000)));
    const S = lazy(() => {
      const r = rng('pt' + c.block.id + shape);
      const target = new Float32Array(n * 3), start = new Float32Array(n * 3), cols = new Float32Array(n * 3);
      let tp = null;
      if (shape === 'text') tp = textPoints(String(block.text || 'MOTIF'), env.fonts.display.family.map((f) => `"${f}"`).join(','), n);
      const cA = C3(p.accent), cB = C3(p.accent2 || p.data[1] || p.accent), tmp = new THREE.Color();
      for (let i = 0; i < n; i++) {
        let x, y, z;
        if (shape === 'sphere' || shape === 'network') { const u = r() * 2 - 1, a = r() * TAU, R = 1.6 + (shape === 'network' ? 0 : (r() - 0.5) * 0.08); x = Math.sqrt(1 - u * u) * Math.cos(a) * R; y = u * R; z = Math.sqrt(1 - u * u) * Math.sin(a) * R; }
        else if (shape === 'wave') { const gx = (i % 120) / 119, gz = Math.floor(i / 120) / Math.ceil(n / 120); x = (gx - 0.5) * 7; z = (gz - 0.5) * 7; y = 0; }
        else if (shape === 'text') [x, y, z] = tp[i];
        else { const arm = i % 3, d = r() ** 0.6 * 3, a = (arm / 3) * TAU + d * 1.6 + (r() - 0.5) * 0.5; x = Math.cos(a) * d; z = Math.sin(a) * d; y = (r() - 0.5) * 0.25 * (3 - d) * 0.5; }
        target[i * 3] = x; target[i * 3 + 1] = y; target[i * 3 + 2] = z;
        const R0 = 5 + r() * 4, u0 = r() * 2 - 1, a0 = r() * TAU;
        start[i * 3] = Math.sqrt(1 - u0 * u0) * Math.cos(a0) * R0; start[i * 3 + 1] = u0 * R0; start[i * 3 + 2] = Math.sqrt(1 - u0 * u0) * Math.sin(a0) * R0;
        tmp.copy(cA).lerp(cB, shape === 'galaxy' ? Math.min(1, Math.hypot(x, z) / 3) : (y + 2) / 4);
        cols[i * 3] = tmp.r; cols[i * 3 + 1] = tmp.g; cols[i * 3 + 2] = tmp.b;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
      const mat = new THREE.PointsMaterial({ size: shape === 'text' ? 0.035 : 0.045, map: dotTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: p.dark ? THREE.AdditiveBlending : THREE.NormalBlending, opacity: p.dark ? 0.9 : 0.85 });
      const pts = new THREE.Points(geo, mat);
      const scene = new THREE.Scene(); scene.add(pts);
      let lines = null;
      if (shape === 'network') {
        const seg = [];
        const m = Math.min(n, 600);
        for (let i = 0; i < m; i++) for (let j = i + 1; j < m; j++) { const dx = target[i * 3] - target[j * 3], dy = target[i * 3 + 1] - target[j * 3 + 1], dz = target[i * 3 + 2] - target[j * 3 + 2]; if (dx * dx + dy * dy + dz * dz < 0.22) seg.push(target[i * 3], target[i * 3 + 1], target[i * 3 + 2], target[j * 3], target[j * 3 + 1], target[j * 3 + 2]); }
        const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(seg), 3));
        lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: C3(p.accent), transparent: true, opacity: 0 }));
        scene.add(lines);
      }
      const camera = new THREE.PerspectiveCamera(40, rect.w / rect.h, 0.1, 100);
      return { scene, pts, geo, target, start, camera, lines, r };
    });
    const form = 2.4 * T;
    return {
      duration: form, hold: 3,
      draw(ctx, t) {
        const s = S();
        const pos = s.geo.attributes.position.array;
        for (let i = 0; i < n; i++) {
          const d = (i % 97) / 97 * 0.35;
          const u = EASE.inOutCubic(clamp01((t - d) / form));
          for (let k = 0; k < 3; k++) pos[i * 3 + k] = s.start[i * 3 + k] + (s.target[i * 3 + k] - s.start[i * 3 + k]) * u;
          if (shape === 'wave') pos[i * 3 + 1] += Math.sin(s.target[i * 3] * 1.3 + t * 1.6) * 0.35 * Math.cos(s.target[i * 3 + 2] * 0.9 + t) * u;
          if (shape === 'text' && u >= 1) pos[i * 3 + 2] += Math.sin(t * 2 + i) * 0.01;
        }
        s.geo.attributes.position.needsUpdate = true;
        if (s.lines) s.lines.material.opacity = 0.25 * clamp01((t - form * 0.8) / 0.6);
        s.pts.rotation.y = shape === 'text' ? Math.sin(t * 0.3) * 0.15 : t * (shape === 'galaxy' ? 0.08 : 0.12);
        s.pts.rotation.x = shape === 'galaxy' ? 0.5 : shape === 'wave' ? 0.45 : 0;
        if (s.lines) { s.lines.rotation.copy(s.pts.rotation); }
        s.camera.position.set(0, 0, shape === 'text' ? 5.2 * Math.max(1, 1.6 * rect.h / rect.w) : 7);
        s.camera.lookAt(0, 0, 0);
        if (!renderInto(ctx, s.scene, s.camera, rect)) return fallback(ctx, c, rect);
      },
    };
  },
};

// ───────────────────────────── shape3d ─────────────────────────────
const shape3d = {
  type: 'shape3d',
  measure(block, c, w, maxH) { return { h: Math.min(maxH, w * 0.8), fill: true }; },
  build(block, c, rect) {
    const { env, p } = c;
    const T = env.motion.tempo;
    const kind = block.shape || 'torusknot';
    const matKind = block.material && block.material !== 'auto' ? block.material : { aurora: 'glass', noir: 'metal', blueprint: 'wire', lumen: 'wire', pop: 'matte', ink: 'matte', meadow: 'matte', corporate: 'glass', editorial: 'matte', swiss: 'matte' }[env.theme.id] || 'glass';
    const col = colorOf(p, block.color, p.accent);
    const S = lazy(() => {
      const scene = new THREE.Scene();
      lights(scene, p, { key: 2.6, rim: 2.2 });
      const envT = environment();
      let geo;
      switch (kind) {
        case 'icosahedron': geo = new THREE.IcosahedronGeometry(1.25, 0); break;
        case 'sphere': geo = new THREE.SphereGeometry(1.2, 96, 64); break;
        case 'torus': geo = new THREE.TorusGeometry(1.05, 0.38, 64, 160); break;
        case 'cube': geo = new THREE.BoxGeometry(1.6, 1.6, 1.6, 1, 1, 1); break;
        case 'blob': geo = new THREE.IcosahedronGeometry(1.15, 40); break;
        case 'rings': geo = null; break;
        default: geo = new THREE.TorusKnotGeometry(0.85, 0.28, 300, 48, 2, 3);
      }
      let mat;
      switch (matKind) {
        case 'metal': mat = new THREE.MeshStandardMaterial({ color: C3(col), metalness: 1, roughness: 0.22, envMap: envT, envMapIntensity: 1.2 }); break;
        case 'matte': mat = new THREE.MeshStandardMaterial({ color: C3(col), metalness: 0, roughness: 0.75, envMap: envT, envMapIntensity: 0.5 }); break;
        case 'wire': mat = new THREE.MeshBasicMaterial({ color: C3(col), wireframe: true, transparent: true, opacity: 0.85 }); break;
        case 'glow': mat = new THREE.MeshStandardMaterial({ color: C3(col), emissive: C3(col), emissiveIntensity: 0.9, roughness: 0.4 }); break;
        default: mat = isSoftwareGL()
          // no GPU: a clearcoat "glass-like" look without the transmission pass
          ? new THREE.MeshPhysicalMaterial({ color: C3(mix(col, '#ffffff', 0.45)), metalness: 0.1, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05, iridescence: 0.6, transparent: true, opacity: 0.92, envMap: envT, envMapIntensity: 1.6 })
          : new THREE.MeshPhysicalMaterial({ color: C3(mix(col, '#ffffff', 0.35)), metalness: 0.05, roughness: 0.08, transmission: 0.9, thickness: 1.4, ior: 1.45, iridescence: 0.8, iridescenceIOR: 1.3, clearcoat: 1, envMap: envT, envMapIntensity: 1.4 });
      }
      const group = new THREE.Group(); scene.add(group);
      let mesh = null;
      const rings = [];
      if (geo) { mesh = new THREE.Mesh(geo, mat); group.add(mesh); }
      else for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(new THREE.TorusGeometry(0.7 + i * 0.28, 0.035, 24, 160), new THREE.MeshStandardMaterial({ color: C3(p.data[i % p.data.length]), metalness: 0.6, roughness: 0.3, envMap: envT })); group.add(m); rings.push(m); }
      // backdrop glow disc behind the object
      const glow = new THREE.Mesh(new THREE.CircleGeometry(2.4, 64), new THREE.ShaderMaterial({ uniforms: { c: { value: C3(col) } }, vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }', fragmentShader: 'uniform vec3 c; varying vec2 vU; void main(){ float d = distance(vU, vec2(0.5)); gl_FragColor = vec4(c, smoothstep(0.5, 0.0, d) * 0.35); }', transparent: true, depthWrite: false, blending: p.dark ? THREE.AdditiveBlending : THREE.NormalBlending }));
      glow.position.z = -2.2; scene.add(glow);
      const camera = new THREE.PerspectiveCamera(32, rect.w / rect.h, 0.1, 100);
      camera.position.set(0, 0, 6.2);
      const base = geo && kind === 'blob' ? geo.attributes.position.array.slice() : null;
      return { scene, group, mesh, rings, camera, base, geo };
    });
    return {
      duration: 1.6 * T, hold: 3,
      draw(ctx, t) {
        const s = S();
        const k = env.motion.spring ? env.motion.spring(clamp01(t / 1.4)) : EASE.outBack(clamp01(t / (1.2 * T)));
        s.group.scale.setScalar(Math.max(0.001, 0.55 + 0.45 * k) * Math.min(1, rect.w / rect.h * 1.2));
        s.group.rotation.set(t * 0.21 + 0.4, t * 0.33, t * 0.05);
        s.group.position.y = Math.sin(t * 0.9) * 0.08;
        s.rings.forEach((m, i) => { m.rotation.set(t * (0.3 + i * 0.13), t * (0.2 - i * 0.07), i); });
        if (s.base) {
          const pos = s.geo.attributes.position.array;
          for (let i = 0; i < pos.length; i += 3) {
            const x = s.base[i], y = s.base[i + 1], z = s.base[i + 2];
            const n = 1 + 0.12 * Math.sin(x * 2.2 + t * 1.1) * Math.sin(y * 2.6 + t * 0.9) + 0.06 * Math.sin(z * 4 + t * 1.7);
            pos[i] = x * n; pos[i + 1] = y * n; pos[i + 2] = z * n;
          }
          s.geo.attributes.position.needsUpdate = true; s.geo.computeVertexNormals();
        }
        ctx.save(); ctx.globalAlpha *= clamp01(t / 0.5);
        if (!renderInto(ctx, s.scene, s.camera, rect)) { ctx.restore(); return fallback(ctx, c, rect); }
        ctx.restore();
      },
    };
  },
};

// ───────────────────────────── model (glTF) ─────────────────────────────
const gltfCache = new Map();
function loadGltf(url) {
  if (!gltfCache.has(url)) gltfCache.set(url, new Promise((res) => new GLTFLoader().load(url, (g) => res(g), undefined, (e) => { console.warn('glTF load failed', url, e?.message); res(null); })));
  return gltfCache.get(url);
}

const model = {
  type: 'model',
  measure(block, c, w, maxH) { return { h: Math.min(maxH, w * 0.8), fill: true }; },
  prepare(block, { assets }) {
    const url = assets.urlFor(block.asset);
    if (url) assets.track('gltf:' + url, loadGltf(url));
  },
  build(block, c, rect) {
    const { env, p } = c;
    const url = c.assets?.urlFor(block.asset);
    const entry = url ? c.assets.extra?.get('gltf:' + url) : null;
    let S = null;
    const setup = (gltf) => {
      const scene = new THREE.Scene();
      lights(scene, p, { key: 2.4 });
      scene.environment = environment();
      const obj = gltf.scene.clone(true);
      const box = new THREE.Box3().setFromObject(obj);
      const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
      const k = 2.4 / Math.max(size.x, size.y, size.z || 1);
      obj.position.sub(center.multiplyScalar(k)); obj.scale.setScalar(k);
      const pivot = new THREE.Group(); pivot.add(obj); scene.add(pivot);
      const camera = new THREE.PerspectiveCamera(30, rect.w / rect.h, 0.05, 100);
      camera.position.set(0, 0.6, 5.4); camera.lookAt(0, 0, 0);
      return { scene, pivot, camera };
    };
    return {
      duration: 1.2 * env.motion.tempo, hold: 4,
      draw(ctx, t) {
        const g = entry?.done ? entry.value : null;
        if (!g) return fallback(ctx, c, rect, url ? (entry?.done ? '模型加载失败' : '模型加载中…') : '未设置模型资源');
        S ||= setup(g);
        const e = EASE.outCubic(clamp01(t / 1.2));
        S.pivot.rotation.y = ((block.angle || -25) * Math.PI) / 180 + (block.rotate === false ? 0 : t * 0.35) - (1 - e) * 0.6;
        S.pivot.scale.setScalar(0.85 + 0.15 * e);
        // soft contact shadow
        ctx.save();
        const sh = ctx.createRadialGradient(rect.x + rect.w / 2, rect.y + rect.h * 0.84, 0, rect.x + rect.w / 2, rect.y + rect.h * 0.84, rect.w * 0.3);
        sh.addColorStop(0, toCss('#000000', p.dark ? 0.45 : 0.18 * e)); sh.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = sh; ctx.globalAlpha *= e; ctx.fillRect(rect.x, rect.y + rect.h * 0.7, rect.w, rect.h * 0.3);
        ctx.restore();
        ctx.save(); ctx.globalAlpha *= clamp01(t / 0.5);
        renderInto(ctx, S.scene, S.camera, rect);
        ctx.restore();
      },
    };
  },
};

// ───────────────────────────── molecule ─────────────────────────────
const molecule = {
  type: 'molecule',
  measure(block, c, w, maxH) { return { h: Math.min(maxH, w * 0.75), fill: true }; },
  build(block, c, rect) {
    const { env, p } = c;
    const T = env.motion.tempo;
    const def = block.atoms?.length ? { atoms: block.atoms.map((a) => (Array.isArray(a) ? a : [a.el || a.element, a.x, a.y, a.z || 0])), bonds: (block.bonds || []).map((b) => (Array.isArray(b) ? b : [b.from, b.to, b.order || 1])) } : moleculePreset(block.preset || 'caffeine');
    const atoms = def.atoms;
    const S = lazy(() => {
      const scene = new THREE.Scene();
      lights(scene, p, { key: 2.4, rim: 1.0, hemi: 1.4 });
      const envT = environment();
      const cx = atoms.reduce((s, a) => s + a[1], 0) / atoms.length, cy = atoms.reduce((s, a) => s + a[2], 0) / atoms.length, cz = atoms.reduce((s, a) => s + a[3], 0) / atoms.length;
      const span = Math.max(...atoms.map((a) => Math.hypot(a[1] - cx, a[2] - cy, a[3] - cz))) || 1;
      const k = (def.scale || 1) * 2.1 / span;
      const group = new THREE.Group(); scene.add(group);
      const sphere = new THREE.SphereGeometry(1, 40, 28);
      const mats = {};
      const matFor = (el) => mats[el] ||= new THREE.MeshStandardMaterial({ color: C3(el === 'C' && p.dark ? '#8a8f98' : (ELEMENTS[el] || ELEMENTS.C).color), roughness: 0.3, metalness: 0.1, envMap: envT, envMapIntensity: 0.7 });
      const atomMeshes = atoms.map((a) => {
        const m = new THREE.Mesh(sphere, matFor(a[0]));
        m.position.set((a[1] - cx) * k, (a[2] - cy) * k, (a[3] - cz) * k);
        m.userData.r = (ELEMENTS[a[0]] || ELEMENTS.C).r * k * 0.55;
        group.add(m);
        return m;
      });
      const bondMat = new THREE.MeshStandardMaterial({ color: C3(p.dark ? '#c9ccd2' : '#9aa0a8'), roughness: 0.4, envMap: envT, envMapIntensity: 0.5 });
      const cyl = new THREE.CylinderGeometry(1, 1, 1, 16);
      cyl.translate(0, 0.5, 0);
      const bondMeshes = [];
      for (const [i, j, order = 1] of def.bonds) {
        const A = atomMeshes[i]?.position, B = atomMeshes[j]?.position;
        if (!A || !B) continue;
        const dir = new THREE.Vector3().subVectors(B, A);
        const len = dir.length();
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
        const perp = new THREE.Vector3(0, 0, 1).cross(dir).normalize().multiplyScalar(0.07 * k);
        const offsets = order === 2 ? [perp, perp.clone().negate()] : order === 3 ? [perp, new THREE.Vector3(), perp.clone().negate()] : [new THREE.Vector3()];
        for (const off of offsets) {
          const m = new THREE.Mesh(cyl, bondMat);
          m.position.copy(A).add(off); m.quaternion.copy(q);
          const r = 0.055 * k * (order > 1 ? 0.7 : 1);
          m.userData = { len, r };
          m.scale.set(r, len, r);
          group.add(m);
          bondMeshes.push({ m, i, j });
        }
      }
      const camera = new THREE.PerspectiveCamera(32, rect.w / rect.h, 0.1, 100);
      camera.position.set(0, 0, 8.5);
      return { scene, group, atomMeshes, bondMeshes, camera };
    });
    const per = Math.min(0.06, 1.4 / atoms.length) * T;
    return {
      duration: per * atoms.length + 1.0, hold: 3,
      draw(ctx, t) {
        const s = S();
        s.atomMeshes.forEach((m, i) => { const e = EASE.outBack(clamp01((t - i * per) / 0.5)); m.scale.setScalar(Math.max(0.0001, m.userData.r * e)); });
        s.bondMeshes.forEach((b) => { const e = EASE.outCubic(clamp01((t - Math.max(b.i, b.j) * per - 0.2) / 0.5)); b.m.scale.set(b.m.userData.r, Math.max(0.0001, b.m.userData.len * e), b.m.userData.r); });
        s.group.rotation.set(0.3 + Math.sin(t * 0.2) * 0.2, t * 0.28, 0);
        const fit = Math.min(1, rect.w / rect.h);
        s.camera.position.set(0, 0, 8.5 / Math.max(0.6, fit));
        if (!renderInto(ctx, s.scene, s.camera, rect)) return fallback(ctx, c, rect);
        if (block.labels !== false && atoms.length <= 30) {
          s.group.updateMatrixWorld(true);
          s.atomMeshes.forEach((m, i) => {
            if (atoms[i][0] === 'H' || atoms[i][0] === 'C') return;
            const a = clamp01((t - i * per - 0.4) / 0.4);
            if (a <= 0) return;
            const wp = m.getWorldPosition(new THREE.Vector3());
            const q = project(wp, s.camera, rect);
            label2d(ctx, c, atoms[i][0], q.x, q.y, { align: 'center', alpha: a * 0.95, size: env.sizes.small, color: '#ffffff', weight: 700 });
          });
        }
      },
    };
  },
};

export default [globe, bars3d, surface, particles, shape3d, model, molecule];
