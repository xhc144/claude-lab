// A small single-scattering atmosphere (Rayleigh + Mie). The GPU fills a sky-view lookup table
// from it every frame (see SKYLUT_FS); this CPU twin gives the same answers for the few values the
// engine needs on the JS side: the colour of sunlight and moonlight after the atmosphere, and the
// ambient light the sky dome pours onto the ground.

const RE = 6360e3, RA = 6460e3, CAM_H = 600;
const BR = [5.8e-6, 13.5e-6, 33.1e-6], HR = 8000;
const BM = 10e-6, HM = 1200;
const BO = [0.65e-6, 1.881e-6, 0.085e-6]; // ozone absorption (no scattering): keeps twilight skies blue
const ozone = (y) => Math.max(0, 1 - Math.abs(y - 25000) / 15000);
export const SUN_INTENSITY = 22, MOON_INTENSITY = 0.42;

// distance along ray (origin height h above the surface, direction elevation sinE) to the top of the atmosphere
function rayToTop(h, mu) {
  const r = RE + h;
  const b = r * mu, c = r * r - RA * RA;
  return -b + Math.sqrt(Math.max(0, b * b - c));
}

// optical depth (Rayleigh, Mie, ozone) from height h along direction elevation mu, n samples
function opticalDepth(h, mu, n = 8) {
  const L = rayToTop(h, mu);
  const ds = L / n;
  let odR = 0, odM = 0, odO = 0;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) * ds; // (light paths are short and steep enough for even spacing)
    const r = RE + h;
    const y = Math.sqrt(r * r + t * t + 2 * r * t * mu) - RE;
    odR += Math.exp(-y / HR) * ds; odM += Math.exp(-y / HM) * ds; odO += ozone(y) * ds;
  }
  return [odR, odM, odO];
}
const tau = (c, r, m, o) => BR[c] * r + BM * 1.1 * m + BO[c] * o;

export function transmittance(mu) {
  // below the horizon the light is blocked by the planet; soften the cut a little
  const m = Math.max(mu, -0.02);
  const [odR, odM, odO] = opticalDepth(CAM_H, Math.max(m, 0.0) + 0.002, 10);
  const k = Math.min(1, Math.max(0, (mu + 0.05) / 0.07));
  return [0, 1, 2].map((c) => Math.exp(-tau(c, odR, odM, odO)) * k);
}

// radiance of the sky in direction d, lit by sun (and the moon opposite it)
export function skyRadiance(d, sun) {
  const mu = d[1];
  if (mu < -0.05) return [0, 0, 0];
  const L = rayToTop(CAM_H, Math.max(mu, 0.001));
  const n = 16;
  const cosS = d[0] * sun[0] + d[1] * sun[1] + d[2] * sun[2];
  const g = 0.76;
  const hg = (c) => 3 / (8 * Math.PI) * ((1 - g * g) * (1 + c * c)) / ((2 + g * g) * Math.pow(1 + g * g - 2 * g * c, 1.5));
  const phR = 3 / (16 * Math.PI) * (1 + cosS * cosS); // same for the moon (opposite the sun)
  const phM = hg(cosS), phMm = hg(-cosS);
  let odR = 0, odM = 0, odO = 0;
  const out = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    // quadratic spacing: most samples in the dense air near the viewer
    const f0 = i / n, f1 = (i + 1) / n;
    const t = L * ((f0 + f1) / 2) ** 2, ds = L * (f1 * f1 - f0 * f0);
    const r = RE + CAM_H;
    const y = Math.sqrt(r * r + t * t + 2 * r * t * mu) - RE;
    const hr = Math.exp(-y / HR) * ds, hm = Math.exp(-y / HM) * ds;
    odR += hr; odM += hm; odO += ozone(y) * ds;
    for (const [lm, inten, pm] of [[sun[1], SUN_INTENSITY, phM], [-sun[1], MOON_INTENSITY, phMm]]) {
      if (lm < -0.1) continue;
      const [lR, lM, lO] = opticalDepth(y, Math.max(lm, 0.0) + 0.002, 4);
      const k = Math.min(1, Math.max(0, (lm + 0.08) / 0.1));
      for (let c = 0; c < 3; c++) {
        const T = Math.exp(-tau(c, odR + lR, odM + lM, odO + lO));
        // single scattering, plus a cheap isotropic stand-in for the multiple-scattered light
        out[c] += T * (hr * BR[c] * (phR + 0.022) + hm * BM * (pm + 0.008)) * inten * k;
      }
    }
  }
  return out;
}

// Everything the renderer needs from the sky for one moment. sun: unit vector toward the sun.
export function skyLighting(sun, rain = 0) {
  const sunT = transmittance(sun[1]);
  const moonT = transmittance(-sun[1]);
  // direct light: whichever body is up, crossfading through twilight so shadows never pop
  const sunUp = Math.min(1, Math.max(0, (sun[1] + 0.02) / 0.12));
  const moonUp = Math.min(1, Math.max(0, (-sun[1] + 0.02) / 0.12));
  const overcast = 1 - rain * 0.75;
  const sunCol = sunT.map((t) => t * 2.7 * sunUp * overcast);
  const moonCol = [0.62, 0.72, 1.0].map((c, i) => c * moonT[i] * 0.22 * moonUp * overcast);
  const useSun = sun[1] > -0.04;
  const lightDir = useSun ? sun : [-sun[0], -sun[1], -sun[2]];
  const lightCol = useSun ? sunCol : moonCol;
  // ambient: average sky radiance over the upper hemisphere (a handful of directions)
  const dirs = [[0, 1, 0], [0.7, 0.7, 0], [-0.7, 0.7, 0], [0, 0.7, 0.7], [0, 0.7, -0.7], [0.96, 0.28, 0], [-0.96, 0.28, 0], [0, 0.28, 0.96], [0, 0.28, -0.96]];
  const w = [2, 1, 1, 1, 1, 0.6, 0.6, 0.6, 0.6];
  const amb = [0, 0, 0];
  let ws = 0;
  dirs.forEach((d, i) => { const l = Math.hypot(...d); const s = skyRadiance(d.map((v) => v / l), sun); for (let c = 0; c < 3; c++) amb[c] += s[c] * w[i]; ws += w[i]; });
  const gray = (amb[0] + amb[1] + amb[2]) / 3;
  const ambient = amb.map((a) => (a / ws) * Math.PI * 0.62).map((a, c) => (a * (1 - rain * 0.6) + gray / ws * Math.PI * 0.55 * rain * 0.6));
  return { lightDir, lightCol, sunCol, moonCol, ambient, sunT };
}
