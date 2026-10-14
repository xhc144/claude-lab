// One shared WebGL renderer for every 3D block. Each block owns a scene + camera; per frame we
// render into the shared canvas (bottom-left viewport) and composite into the 2D frame, so 3D
// content participates in the same deterministic timeline, transitions and export path.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

let renderer = null, failed = false, envTex = null;

export function getRenderer() {
  if (renderer || failed) return renderer;
  try {
    const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : new OffscreenCanvas(16, 16);
    canvas.width = 16; canvas.height = 16;
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.setClearColor(0x000000, 0);
  } catch (e) {
    failed = true;
    console.warn('WebGL unavailable:', e.message);
  }
  return renderer;
}

let softGL = null;
/** True when WebGL runs on a CPU rasterizer (SwiftShader/llvmpipe): use cheaper materials. */
export function isSoftwareGL() {
  if (softGL != null) return softGL;
  const r = getRenderer();
  if (!r) return (softGL = true);
  try {
    const gl = r.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    softGL = /swiftshader|llvmpipe|software|basic render/i.test(name);
  } catch { softGL = false; }
  return softGL;
}

export function environment() {
  const r = getRenderer();
  if (!r) return null;
  if (!envTex) {
    const pm = new THREE.PMREMGenerator(r);
    envTex = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
  }
  return envTex;
}

/** Pixel scale of the current 2D transform (design px → device px). */
export function ctxScale(ctx) {
  const m = ctx.getTransform();
  return Math.hypot(m.a, m.b) || 1;
}

/**
 * Render scene with camera into the rect of a 2D context.
 * Returns false when WebGL is unavailable (caller draws a fallback).
 */
export function renderInto(ctx, scene, camera, rect, opts = {}) {
  const r = getRenderer();
  if (!r) return false;
  const s = Math.min(ctxScale(ctx), opts.maxScale ?? 2);
  const w = Math.max(2, Math.round(rect.w * s)), h = Math.max(2, Math.round(rect.h * s));
  const cw = Math.max(r.domElement.width, w), ch = Math.max(r.domElement.height, h);
  if (cw !== r.domElement.width || ch !== r.domElement.height) r.setSize(Math.min(cw, 4096), Math.min(ch, 4096), false);
  const CW = r.domElement.width, CH = r.domElement.height;
  if (camera.isPerspectiveCamera) { camera.aspect = rect.w / rect.h; camera.updateProjectionMatrix(); }
  r.setScissorTest(true);
  r.setViewport(0, 0, w, h);
  r.setScissor(0, 0, w, h);
  r.setClearColor(0x000000, 0);
  r.clear(true, true, true);
  r.render(scene, camera);
  r.setScissorTest(false);
  ctx.drawImage(r.domElement, 0, CH - h, w, h, rect.x, rect.y, rect.w, rect.h);
  void CW;
  return true;
}

/** Project a world point to 2D coordinates inside rect. */
export function project(v, camera, rect) {
  const p = v.clone().project(camera);
  return { x: rect.x + ((p.x + 1) / 2) * rect.w, y: rect.y + ((1 - p.y) / 2) * rect.h, z: p.z, visible: p.z < 1 && p.z > -1 };
}

export function color(c) { return new THREE.Color(c); }

/** Soft round sprite texture for point clouds. */
let dotTex = null;
export function dotTexture() {
  if (dotTex) return dotTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  dotTex = new THREE.CanvasTexture(c);
  dotTex.colorSpace = THREE.SRGBColorSpace;
  return dotTex;
}

export { THREE };
