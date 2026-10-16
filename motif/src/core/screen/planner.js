// Automatic camera ("自动运镜") for screen recordings: zoom in where the user clicks.
//
// Ported from DogSC's AutoZoomPlanner (MIT, © 2026 神烦老狗, github.com/laogou717/dogsc):
//   1. clicks less than `groupGap` apart form one temporal group;
//   2. inside a group, clicks that fit in the zoomed viewport form one spatial region, so the
//      camera holds still while the user works in one area and moves only for a new region;
//   3. each group's last region is held while the pointer keeps moving (idle gap ≤ 1.4 s), then
//      settles for a moment before zooming out;
//   4. touching automatic segments with the same scale merge into one.
// Times are source seconds; positions are 0–1 in the recorded picture.

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/** Clicks from a pointer track: [{ t, x, y }]. */
export function clicksOf(events) {
  return (events || []).filter((e) => e.k === 1 || e.k === 2).map((e) => ({ t: e.t, x: e.x, y: e.y })).filter((c) => Number.isFinite(c.t) && c.t >= 0).sort((a, b) => a.t - b.t);
}

export function planZooms(events, o = {}) {
  const scale = clamp(o.scale ?? 1.6, 1.1, 4);
  const enter = clamp(o.enter ?? 0.7, 0, 5);
  const exit = clamp(o.exit ?? 0.7, 0, 5);
  const hold = o.hold ?? 0.9;
  const groupGap = o.groupGap ?? 1.4;
  const safe = o.safeInset ?? 0.12;
  const easing = o.easing || 'spring';
  const duration = o.duration ?? Infinity;
  const clicks = clicksOf(events);
  const groups = [];
  for (const c of clicks) {
    const g = groups.at(-1);
    if (g && c.t - g.at(-1).t <= groupGap) g.push(c); else groups.push([c]);
  }
  const visible = 1 / Math.max(scale, 1);
  const out = [];
  let earliest = 0;
  for (const g of groups) {
    const regions = [];
    for (const c of g) {
      const r = regions.at(-1);
      if (r && Math.max(r.maxX, c.x) - Math.min(r.minX, c.x) <= visible * 0.5 && Math.max(r.maxY, c.y) - Math.min(r.minY, c.y) <= visible * 0.7) {
        r.minX = Math.min(r.minX, c.x); r.maxX = Math.max(r.maxX, c.x); r.minY = Math.min(r.minY, c.y); r.maxY = Math.max(r.maxY, c.y);
      } else regions.push({ first: c.t, minX: c.x, maxX: c.x, minY: c.y, maxY: c.y });
    }
    const starts = [Math.max(g[0].t - enter * 0.18, earliest, 0)];
    for (const r of regions.slice(1)) starts.push(Math.max(r.first - enter, starts.at(-1) + 0.16));
    regions.forEach((r, i) => {
      const last = i === regions.length - 1;
      const start = starts[i];
      const end = last ? Math.max(g.at(-1).t + hold, start + enter) : starts[i + 1];
      if (end - start <= 0.01) return;
      out.push({
        start, end, scale, mode: 'auto', easing, enter, exit: last ? exit : 0,
        focus: [clamp((r.minX + r.maxX) / 2, safe, 1 - safe), clamp((r.minY + r.maxY) / 2, safe, 1 - safe)],
      });
    });
    if (out.length) earliest = out.at(-1).end + out.at(-1).exit;
  }
  extendThroughActivity(out, clicks, events || []);
  const merged = mergeTouching(out);
  // Never past the end of the recording.
  return merged.filter((z) => z.start < duration).map((z) => {
    const end = Math.min(z.end, duration);
    return { ...z, end, exit: Math.min(z.exit, Math.max(0, duration - end)) };
  }).filter((z) => z.end - z.start > 0.01).map((z, i) => ({ ...z, id: `z${i + 1}` }));
}

function extendThroughActivity(zooms, clicks, events, idleGap = 1.4, settle = 0.55) {
  const evs = events.filter((e) => e.t >= 0).sort((a, b) => a.t - b.t);
  zooms.forEach((z, i) => {
    if (z.exit <= 0.001) return;
    const lastClick = [...clicks].reverse().find((c) => c.t <= z.end + 1e-4);
    if (!lastClick || lastClick.t < z.start - 1e-4) return;
    const next = zooms[i + 1] ? zooms[i + 1].start : Infinity;
    let prevT = lastClick.t;
    let endT = lastClick.t;
    for (const e of evs) {
      if (e.t <= lastClick.t) continue;
      if (e.t >= next - 1e-4 || e.t - prevT > idleGap) break;
      prevT = e.t; endT = e.t;
    }
    if (endT <= lastClick.t + 1e-4) return;
    const end = Math.min(Math.max(z.end, endT + settle), next);
    if (end <= z.end + 1e-4) return;
    z.end = end;
    if (Number.isFinite(next)) z.exit = Math.min(z.exit, Math.max(next - end, 0));
  });
}

function mergeTouching(zooms) {
  const out = [];
  for (const z of [...zooms].sort((a, b) => a.start - b.start)) {
    const p = out.at(-1);
    if (p && p.mode === 'auto' && z.mode === 'auto' && p.exit <= 1 / 120 && Math.abs(p.end - z.start) <= 1 / 120 && Math.abs(p.scale - z.scale) < 1e-6 && p.easing === z.easing) {
      // One continuous automatic shot: the camera follows the cursor inside it (see cursor.js).
      p.end = Math.max(p.end, z.end);
      p.exit = z.exit;
    } else out.push({ ...z });
  }
  return out;
}
