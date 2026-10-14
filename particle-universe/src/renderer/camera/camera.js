import { mat4, vec3 } from 'gl-matrix';

export class Camera {
  constructor() {
    this.pos = vec3.fromValues(0, 4, 24);
    this.target = vec3.fromValues(0, 0, 0);
    this.up = vec3.fromValues(0, 1, 0);
    this.roll = 0;
    this.fov = 50; // degrees, vertical
    this.near = 0.05;
    this.far = 4000;
    this.aspect = 16 / 9;
    this.view = mat4.create();
    this.proj = mat4.create();
    this.viewProj = mat4.create();
    this.invViewProj = mat4.create();
    this._fwd = vec3.create();
    this._up = vec3.create();
  }

  set(pose) {
    vec3.copy(this.pos, pose.pos);
    vec3.copy(this.target, pose.target);
    this.fov = pose.fov;
    this.roll = pose.roll || 0;
  }

  update(aspect) {
    this.aspect = aspect;
    const fwd = vec3.sub(this._fwd, this.target, this.pos);
    vec3.normalize(fwd, fwd);
    // roll around the view axis
    let up = vec3.set(this._up, 0, 1, 0);
    if (Math.abs(vec3.dot(fwd, up)) > 0.995) vec3.set(up, 0, 0, 1);
    if (this.roll) {
      const right = vec3.cross(vec3.create(), fwd, up);
      vec3.normalize(right, right);
      const u2 = vec3.cross(vec3.create(), right, fwd);
      up = vec3.scaleAndAdd(vec3.create(), vec3.scale(vec3.create(), u2, Math.cos(this.roll)), right, Math.sin(this.roll));
    }
    mat4.lookAt(this.view, this.pos, this.target, up);
    mat4.perspective(this.proj, (this.fov * Math.PI) / 180, aspect, this.near, this.far);
    mat4.mul(this.viewProj, this.proj, this.view);
    mat4.invert(this.invViewProj, this.viewProj);
    return this;
  }

  // Pixels per world unit at distance 1 for a viewport of height h.
  pxPerUnit(h) { return this.proj[5] * h * 0.5; }

  // Project world point → {x,y} in uv [0,1] (y up), depth along the view axis.
  project(p) {
    const v = this.view, P = this.proj;
    const x = v[0] * p[0] + v[4] * p[1] + v[8] * p[2] + v[12];
    const y = v[1] * p[0] + v[5] * p[1] + v[9] * p[2] + v[13];
    const z = v[2] * p[0] + v[6] * p[1] + v[10] * p[2] + v[14];
    const cx = P[0] * x + P[8] * z, cy = P[5] * y + P[9] * z, cw = -z;
    return { u: (cx / cw) * 0.5 + 0.5, v: (cy / cw) * 0.5 + 0.5, depth: -z, viewX: x, viewY: y };
  }
}

export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);
export const smoother = (t) => t * t * t * (t * (t * 6 - 15) + 10);

export function lerpPose(a, b, t, out) {
  out = out || { pos: vec3.create(), target: vec3.create(), fov: 50, roll: 0 };
  vec3.lerp(out.pos, a.pos, b.pos, t);
  vec3.lerp(out.target, a.target, b.target, t);
  out.fov = lerp(a.fov, b.fov, t);
  out.roll = lerp(a.roll || 0, b.roll || 0, t);
  return out;
}

export function makePose(pos = [0, 0, 20], target = [0, 0, 0], fov = 50, roll = 0) {
  return { pos: vec3.fromValues(...pos), target: vec3.fromValues(...target), fov, roll };
}

export function copyPose(src, dst) {
  dst = dst || makePose();
  vec3.copy(dst.pos, src.pos);
  vec3.copy(dst.target, src.target);
  dst.fov = src.fov;
  dst.roll = src.roll || 0;
  return dst;
}
