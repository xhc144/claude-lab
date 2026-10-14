// Free camera: damped orbit (or look-around for tunnel scenes) with mouse, wheel and keyboard.
import { vec3 } from 'gl-matrix';
import { makePose } from './camera.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class FreeControls {
  constructor(el) {
    this.el = el;
    this.mode = 'orbit';
    this.yaw = 0; this.pitch = 0.25; this.dist = 24;
    this.gYaw = 0; this.gPitch = 0.25; this.gDist = 24;
    this.target = vec3.fromValues(0, 0, 0);
    this.gTarget = vec3.fromValues(0, 0, 0);
    this.eye = vec3.fromValues(0, 0, 0); // for look mode
    this.fov = 50;
    this.minDist = 2; this.maxDist = 200;
    this.autoRotate = 0;
    this.keys = new Set();
    this.drag = null;
    this.onInteract = null;
    this.pose = makePose();
    this._bind();
  }

  _bind() {
    const el = this.el;
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('pointerdown', (e) => {
      if (e.button > 2) return;
      el.setPointerCapture(e.pointerId);
      this.drag = { x: e.clientX, y: e.clientY, button: e.button, shift: e.shiftKey, moved: false };
    });
    el.addEventListener('pointermove', (e) => {
      if (!this.drag) return;
      const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
      if (!this.drag.moved && Math.abs(dx) + Math.abs(dy) < 3) return;
      if (!this.drag.moved) { this.drag.moved = true; this.onInteract && this.onInteract(); }
      this.drag.x = e.clientX; this.drag.y = e.clientY;
      const s = 0.0045;
      if (this.drag.button === 0 && !this.drag.shift) {
        this.gYaw -= dx * s;
        this.gPitch = clamp(this.gPitch + dy * s, -1.45, 1.45);
      } else {
        this._pan(dx, dy);
      }
    });
    const end = (e) => { if (this.drag) { try { el.releasePointerCapture(e.pointerId); } catch { /* ignore */ } } this.drag = null; };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.onInteract && this.onInteract();
      const k = Math.exp(Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), 120) * 0.0015);
      if (this.mode === 'orbit') this.gDist = clamp(this.gDist * k, this.minDist, this.maxDist);
      else this.fov = clamp(this.fov * k, 20, 100);
    }, { passive: false });
  }

  _pan(dx, dy) {
    if (this.mode !== 'orbit') return;
    const s = this.dist * 0.0012;
    const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
    const right = [cy, 0, -sy];
    const up = [-Math.sin(this.pitch) * sy, Math.cos(this.pitch), -Math.sin(this.pitch) * cy];
    for (let i = 0; i < 3; i++) this.gTarget[i] += (-right[i] * dx + up[i] * dy) * s;
  }

  key(code, down) {
    if (down) this.keys.add(code); else this.keys.delete(code);
  }

  configure({ mode = 'orbit', minDist = 2, maxDist = 200, target = [0, 0, 0] }) {
    this.mode = mode;
    this.minDist = minDist; this.maxDist = maxDist;
    this.home = target;
  }

  // Initialise from an arbitrary pose (e.g. where the auto camera currently is).
  fromPose(pose) {
    const d = vec3.sub(vec3.create(), pose.pos, pose.target);
    const dist = vec3.length(d);
    this.fov = pose.fov;
    if (this.mode === 'orbit') {
      vec3.copy(this.target, pose.target); vec3.copy(this.gTarget, pose.target);
      this.dist = this.gDist = clamp(dist, this.minDist, this.maxDist);
      this.pitch = this.gPitch = Math.asin(clamp(d[1] / Math.max(dist, 1e-6), -0.999, 0.999));
      this.yaw = this.gYaw = Math.atan2(d[0], d[2]);
    } else {
      vec3.copy(this.eye, pose.pos);
      const f = vec3.scale(vec3.create(), d, -1 / Math.max(dist, 1e-6));
      this.pitch = this.gPitch = Math.asin(clamp(f[1], -0.999, 0.999));
      this.yaw = this.gYaw = Math.atan2(f[0], f[2]);
      this.lookDist = dist;
    }
  }

  update(dt) {
    const k = 1 - Math.exp(-dt * 9);
    if (this.autoRotate && !this.drag) this.gYaw += this.autoRotate * dt;
    // keyboard: WASD orbit / QE zoom
    const kr = 1.6 * dt;
    if (this.keys.has('KeyA')) this.gYaw += kr;
    if (this.keys.has('KeyD')) this.gYaw -= kr;
    if (this.keys.has('KeyW')) this.gPitch = clamp(this.gPitch + kr * 0.6, -1.45, 1.45);
    if (this.keys.has('KeyS')) this.gPitch = clamp(this.gPitch - kr * 0.6, -1.45, 1.45);
    if (this.keys.has('KeyQ')) this.gDist = clamp(this.gDist * (1 + dt * 1.2), this.minDist, this.maxDist);
    if (this.keys.has('KeyE')) this.gDist = clamp(this.gDist * (1 - dt * 1.2), this.minDist, this.maxDist);
    this.yaw += (this.gYaw - this.yaw) * k;
    this.pitch += (this.gPitch - this.pitch) * k;
    this.dist += (this.gDist - this.dist) * k;
    vec3.lerp(this.target, this.target, this.gTarget, k);
    const cp = Math.cos(this.pitch);
    const dir = [Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp];
    if (this.mode === 'orbit') {
      vec3.set(this.pose.pos, this.target[0] + dir[0] * this.dist, this.target[1] + dir[1] * this.dist, this.target[2] + dir[2] * this.dist);
      vec3.copy(this.pose.target, this.target);
    } else {
      vec3.copy(this.pose.pos, this.eye);
      vec3.set(this.pose.target, this.eye[0] + dir[0] * 10, this.eye[1] + dir[1] * 10, this.eye[2] + dir[2] * 10);
    }
    this.pose.fov = this.fov;
    this.pose.roll = 0;
    return this.pose;
  }

  reset(pose) { this.fromPose(pose); }
}
