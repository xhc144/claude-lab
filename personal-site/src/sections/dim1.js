// Dimension 1: a curve drawn across a horizontally scrolling rail, lighting stations as t grows.
import { track } from '../core/scroll.js';

const W = 3200, H = 560;

function catmull(points) {
  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)], p1 = points[i], p2 = points[i + 1], p3 = points[Math.min(points.length - 1, i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${c1[0].toFixed(1)} ${c1[1].toFixed(1)}, ${c2[0].toFixed(1)} ${c2[1].toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

export function initDim1() {
  const stage = document.getElementById('track');
  const rail = stage.querySelector('.track-rail');
  const path = stage.querySelector('.track-path');
  const ghost = stage.querySelector('.track-ghost');
  const stations = [...stage.querySelectorAll('.station')];
  const tOut = document.getElementById('track-t');
  const ys = (at) => H * (0.5 + 0.26 * Math.sin(at * Math.PI * 5.2 + 0.4));
  const pts = [[0, ys(0)]];
  stations.forEach((s) => {
    const at = Number(s.dataset.at);
    const x = at * W, y = ys(at);
    pts.push([x, y]);
    s.style.left = `${at * 100}%`;
    s.style.top = `${(y / H) * 100}%`;
    s.classList.add(y < H * 0.5 ? 'below' : 'above');
  });
  for (let k = 1; k <= 24; k++) { const at = k / 24; if (!stations.some((s) => Math.abs(Number(s.dataset.at) - at) < 0.03)) pts.push([at * W, ys(at)]); }
  pts.sort((a, b) => a[0] - b[0]);
  pts.push([W, ys(1)]);
  const d = catmull(pts);
  path.setAttribute('d', d);
  ghost.setAttribute('d', d);
  const len = path.getTotalLength();
  path.style.strokeDasharray = `${len}`;

  // map pinned progress p → which fraction of the rail sits at the screen centre
  let lastP = 0;
  const update = (p) => {
    lastP = p;
    const frac = 0.03 + p * 0.94;
    const railW = rail.offsetWidth;
    rail.style.transform = `translateX(${(innerWidth * 0.5 - frac * railW).toFixed(1)}px)`;
    path.style.strokeDashoffset = `${len * (1 - frac)}`;
    tOut.textContent = frac.toFixed(3);
    for (const s of stations) s.classList.toggle('is-lit', Number(s.dataset.at) <= frac + 0.01);
  };
  track(stage, update, 'pin');
  addEventListener('resize', () => update(lastP));
}
