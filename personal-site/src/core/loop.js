// One requestAnimationFrame loop for the whole page.
export const clock = { time: 0, dt: 1 / 60, frame: 0, fps: 60 };
const tasks = new Set();
let last = 0;
let fpsAcc = 0, fpsN = 0;

export function onFrame(fn) {
  tasks.add(fn);
  return () => tasks.delete(fn);
}

function tick(now) {
  const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
  last = now;
  clock.dt = dt;
  clock.time += dt;
  clock.frame++;
  fpsAcc += dt; fpsN++;
  if (fpsAcc > 0.5) { clock.fps = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; }
  for (const fn of tasks) {
    try { fn(clock); } catch (err) { console.error(err); tasks.delete(fn); }
  }
  requestAnimationFrame(tick);
}

export function startLoop() {
  requestAnimationFrame(tick);
  document.addEventListener('visibilitychange', () => { last = 0; });
}
