// Adaptive sampling of parametric curves s ↦ P(s) ∈ ℝ², used to draw images of grid lines under
// complex maps. Segments are bisected until shorter than `tol`; a segment that is still longer
// than `breakLen` after `maxDepth` bisections is a jump (branch cut, pole) and the polyline is
// split there. Non-finite points also split the curve.

/**
 * @param {(s:number, out:Float64Array)=>void} P  writes the point for parameter s into out[0..1]
 * @returns {number[][]} list of polylines, each a flat array [x0, y0, x1, y1, …]
 */
export function adaptiveCurve(P, s0, s1, { samples = 120, tol = 0.02, breakLen = 0.5, maxDepth = 12, bounds = null } = {}) {
  const out = new Float64Array(2);
  const at = (s) => { P(s, out); return [out[0], out[1]]; };
  const lines = [];
  let cur = null;
  const finite = (p) => Number.isFinite(p[0]) && Number.isFinite(p[1]);
  const emit = (p) => {
    if (!cur) { cur = [p[0], p[1]]; lines.push(cur); } else cur.push(p[0], p[1]);
  };
  const cut = () => { cur = null; };
  // both endpoints beyond the same edge of the (padded) view: nothing visible, don't refine
  const offscreen = (a, b) => {
    if (!bounds) return false;
    const { xmin, xmax, ymin, ymax } = bounds;
    return (a[0] < xmin && b[0] < xmin) || (a[0] > xmax && b[0] > xmax) || (a[1] < ymin && b[1] < ymin) || (a[1] > ymax && b[1] > ymax);
  };

  function refine(sa, pa, sb, pb, depth) {
    const fa = finite(pa), fb = finite(pb);
    if (!fa || !fb) {
      if (depth < maxDepth && (fa || fb)) {
        const sm = 0.5 * (sa + sb);
        const pm = at(sm);
        refine(sa, pa, sm, pm, depth + 1);
        refine(sm, pm, sb, pb, depth + 1);
        return;
      }
      cut();
      if (fb) emit(pb);
      return;
    }
    const d = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]);
    if (d <= tol) { emit(pb); return; }
    if (offscreen(pa, pb) && depth > 2) {
      if (d > breakLen) cut();
      emit(pb);
      return;
    }
    if (depth >= maxDepth) {
      if (d > breakLen) { cut(); }
      emit(pb);
      return;
    }
    const sm = 0.5 * (sa + sb);
    const pm = at(sm);
    refine(sa, pa, sm, pm, depth + 1);
    refine(sm, pm, sb, pb, depth + 1);
  }

  let sa = s0;
  let pa = at(sa);
  if (finite(pa)) emit(pa);
  for (let k = 1; k <= samples; k++) {
    const sb = s0 + ((s1 - s0) * k) / samples;
    const pb = at(sb);
    refine(sa, pa, sb, pb, 0);
    sa = sb;
    pa = pb;
  }
  return lines.filter((l) => l.length >= 4);
}

/** Robust bounding box of many polylines: per-axis quantiles, ignoring outliers near poles. */
export function robustBounds(lines, q = 0.02) {
  const xs = [], ys = [];
  for (const l of lines) {
    for (let k = 0; k < l.length; k += 2) {
      xs.push(l[k]);
      ys.push(l[k + 1]);
    }
  }
  if (!xs.length) return null;
  xs.sort((a, b) => a - b);
  ys.sort((a, b) => a - b);
  const pick = (arr, f) => arr[Math.min(arr.length - 1, Math.max(0, Math.round(f * (arr.length - 1))))];
  return { xmin: pick(xs, q), xmax: pick(xs, 1 - q), ymin: pick(ys, q), ymax: pick(ys, 1 - q) };
}
