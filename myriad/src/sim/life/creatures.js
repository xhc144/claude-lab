// Creatures: individual agents stored as structure-of-arrays for speed. Each one forages,
// hunts or flees, migrates towards its preferred climate, herds with its own kind, ages, starves,
// is eaten, and reproduces with mutation. Nothing about species boundaries, sapience or climate
// adaptation is scripted — they emerge from who survives where.

import { NG, G } from '../constants.js';
import { tempAt, seaIce, pushFx } from '../state.js';
import { phenotype, mutateInto, geneticDistance, HAB_WATER, HAB_AMPHI, HAB_LAND, ARCHETYPES } from './genome.js';
import { createSpecies, markExtinct } from './species.js';
import { log } from '../chronicle.js';

export const SPECIATION = 0.2;
const BIN = 4;
const TWO_PI = Math.PI * 2;
const tmpT = {};

export function initLife(w, cap) {
  const L = {
    cap,
    hi: 0, // one past the highest slot ever used
    count: 0,
    nextId: 1,
    free: new Int32Array(cap),
    nFree: 0,
    alive: new Uint8Array(cap),
    uid: new Int32Array(cap),
    sp: new Int32Array(cap),
    x: new Float32Array(cap),
    y: new Float32Array(cap),
    dir: new Float32Array(cap),
    energy: new Float32Array(cap),
    age: new Float32Array(cap),
    cd: new Float32Array(cap),
    tp: new Uint8Array(cap), // portal cooldown
    gen: new Float32Array(cap * NG),
    // cached phenotype
    pSize: new Float32Array(cap), pSpeed: new Float32Array(cap), pMetab: new Float32Array(cap),
    pDiet: new Float32Array(cap), pTopt: new Float32Array(cap), pTol: new Float32Array(cap),
    pHab: new Uint8Array(cap), pFly: new Uint8Array(cap), pMaxAge: new Float32Array(cap),
    pSense: new Float32Array(cap), pIntel: new Float32Array(cap), pSocial: new Float32Array(cap),
    pAggr: new Float32Array(cap), pArmor: new Float32Array(cap), pLitter: new Uint8Array(cap),
    pEmax: new Float32Array(cap), pPower: new Float32Array(cap), pDef: new Float32Array(cap),
    pForm: new Uint8Array(cap),
    // spatial bins (rebuilt every tick)
    nbx: Math.ceil(w.W / BIN), nby: Math.ceil(w.H / BIN),
    binHead: null, next: new Int32Array(cap),
    stats: { births: 0, deaths: 0, starved: 0, eaten: 0, old: 0, disaster: 0, hunted: 0, disease: 0 },
    plague: new Float32Array(64), // per-species disease pressure
  };
  L.binHead = new Int32Array(L.nbx * L.nby).fill(-1);
  w.life = L;
  w.species = w.species || [];
  w.awakenings = [];
  w.monoliths = w.monoliths || [];
  w.bubbles = w.bubbles || [];
  w.portals = w.portals || [];
  return L;
}

/** can creature i stand in cell c? */
function habitable(w, L, i, c) {
  const water = w.elev[c] < w.seaLevel || w.lake[c] > 0;
  const h = L.pHab[i];
  if (h === HAB_WATER) return water;
  if (h === HAB_AMPHI) return !water || w.lake[c] > 0 || w.elev[c] > w.seaLevel - 0.12;
  if (!water) return true;
  return L.pFly[i] === 1 || seaIce(w, c);
}

export function canLive(w, hab, fly, c) {
  const water = w.elev[c] < w.seaLevel || w.lake[c] > 0;
  if (hab === HAB_WATER) return water;
  if (hab === HAB_AMPHI) return !water || w.lake[c] > 0 || w.elev[c] > w.seaLevel - 0.12;
  return !water || fly;
}

function applyPhenotype(L, i) {
  phenotype(L.gen, i * NG, tmpT);
  L.pSize[i] = tmpT.size; L.pSpeed[i] = tmpT.speed; L.pMetab[i] = tmpT.metab; L.pDiet[i] = tmpT.diet;
  L.pTopt[i] = tmpT.topt; L.pTol[i] = tmpT.tol; L.pHab[i] = tmpT.hab; L.pFly[i] = tmpT.fly ? 1 : 0;
  L.pMaxAge[i] = tmpT.maxAge; L.pSense[i] = tmpT.sense; L.pIntel[i] = tmpT.intel; L.pSocial[i] = tmpT.social;
  L.pAggr[i] = tmpT.aggr; L.pArmor[i] = tmpT.armor; L.pLitter[i] = tmpT.litter; L.pEmax[i] = tmpT.emax;
  L.pPower[i] = tmpT.power; L.pDef[i] = tmpT.defense; L.pForm[i] = tmpT.form;
}

function allocSlot(L) {
  if (L.nFree > 0) return L.free[--L.nFree];
  if (L.hi < L.cap) return L.hi++;
  return -1;
}

/** create a creature of species sp with genome copied (unmutated) from src[so..] */
export function spawnCreature(w, sp, src, so, x, y, energy = 0.6) {
  const L = w.life;
  const i = allocSlot(L);
  if (i < 0) return -1;
  for (let k = 0; k < NG; k++) L.gen[i * NG + k] = src[so + k];
  initSlot(w, L, i, sp, x, y, energy);
  return i;
}

function initSlot(w, L, i, sp, x, y, energy) {
  L.alive[i] = 1;
  L.uid[i] = L.nextId++;
  L.sp[i] = sp;
  L.x[i] = Math.min(w.W - 0.01, Math.max(0, x));
  L.y[i] = Math.min(w.H - 0.01, Math.max(0, y));
  L.dir[i] = w.rng.next() * TWO_PI;
  L.age[i] = 0;
  L.cd[i] = 4;
  L.tp[i] = 0;
  applyPhenotype(L, i);
  L.energy[i] = energy * L.pEmax[i];
  L.count++;
  const s = w.species[sp];
  s.pop++;
  s.births++;
  if (s.pop > s.peak) s.peak = s.pop;
}

export function killCreature(w, i, cause = 'old') {
  const L = w.life;
  if (!L.alive[i]) return;
  L.alive[i] = 0;
  L.free[L.nFree++] = i;
  L.count--;
  L.stats.deaths++;
  if (L.stats[cause] !== undefined) L.stats[cause]++;
  const s = w.species[L.sp[i]];
  s.pop--;
  // carcasses feed the soil
  const c = (L.y[i] | 0) * w.W + (L.x[i] | 0);
  if (w.elev[c] >= w.seaLevel) w.fert[c] = Math.min(1, w.fert[c] + 0.004 * L.pSize[i]);
  if (s.pop <= 0 && s.extinct === null) markExtinct(w, s);
}

/** spawn a founding population of n individuals from gene array `genes` around (x, y) */
export function seedPopulation(w, genes, x, y, n, radius, rng, name = null, parent = -1) {
  const g = Float32Array.from(genes);
  phenotype(g, 0, tmpT);
  const sp = createSpecies(w, g, 0, parent, x, y, rng, name);
  const tmp = new Float32Array(NG);
  radius = Math.max(radius, Math.sqrt(n) * 1.7);
  let placed = 0;
  for (let k = 0; k < n * 6 && placed < n; k++) {
    const a = rng.next() * TWO_PI, r = Math.sqrt(rng.next()) * radius;
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    if (px < 0 || py < 0 || px >= w.W || py >= w.H) continue;
    const c = (py | 0) * w.W + (px | 0);
    if (!canLive(w, tmpT.hab, tmpT.fly, c)) continue;
    mutateInto(tmp, 0, g, 0, rng, 0.02);
    if (spawnCreature(w, sp.id, tmp, 0, px, py, 0.7) >= 0) placed++;
  }
  return sp;
}

/** find a cell suiting a genome (habitat + temperature); null if none found */
export function findHome(w, genes, rng, tries = 400, near = null) {
  const g = Float32Array.from(genes);
  phenotype(g, 0, tmpT);
  let best = null, bs = -1e9;
  for (let t = 0; t < tries; t++) {
    let x, y;
    if (near) { x = near.x + (rng.next() - 0.5) * near.r * 2; y = near.y + (rng.next() - 0.5) * near.r * 2; } else { x = rng.next() * w.W; y = rng.next() * w.H; }
    if (x < 1 || y < 1 || x >= w.W - 1 || y >= w.H - 1) continue;
    const c = (y | 0) * w.W + (x | 0);
    if (!canLive(w, tmpT.hab, tmpT.fly, c)) continue;
    const T = w.baseTemp[c] + w.climate.offset;
    const s = -Math.abs(T - tmpT.topt) + w.veg[c] * 8 + rng.next() * 3;
    if (s > bs) { bs = s; best = { x, y }; }
  }
  return best;
}

function buildBins(L) {
  L.binHead.fill(-1);
  const { nbx } = L;
  for (let i = 0; i < L.hi; i++) {
    if (!L.alive[i]) continue;
    const b = ((L.y[i] / BIN) | 0) * nbx + ((L.x[i] / BIN) | 0);
    L.next[i] = L.binHead[b];
    L.binHead[b] = i;
  }
}

/** visit creatures within radius r of (x, y): fn(i, d2) */
export function forCreaturesNear(w, x, y, r, fn) {
  const L = w.life;
  const bx0 = Math.max(0, ((x - r) / BIN) | 0), bx1 = Math.min(L.nbx - 1, ((x + r) / BIN) | 0);
  const by0 = Math.max(0, ((y - r) / BIN) | 0), by1 = Math.min(L.nby - 1, ((y + r) / BIN) | 0);
  const r2 = r * r;
  for (let by = by0; by <= by1; by++) {
    for (let bx = bx0; bx <= bx1; bx++) {
      for (let j = L.binHead[by * L.nbx + bx]; j >= 0; j = L.next[j]) {
        if (!L.alive[j]) continue;
        const dx = L.x[j] - x, dy = L.y[j] - y;
        const d2 = dx * dx + dy * dy;
        if (d2 <= r2 && fn(j, d2) === false) return;
      }
    }
  }
}

function probeScore(w, L, i, x, y) {
  if (x < 0 || y < 0 || x >= w.W || y >= w.H) return -100;
  const c = (y | 0) * w.W + (x | 0);
  if (!habitable(w, L, i, c)) return -50;
  const T = tempAt(w, c);
  const dT = Math.max(0, Math.abs(T - L.pTopt[i]) - L.pTol[i] * 0.6);
  let s = w.veg[c] * (1 - L.pDiet[i]) * 3 - dT * 0.25;
  if (w.fire[c] || w.lava[c] > 0) s -= 30;
  if (w.flood[c] > 0.002 && L.pHab[i] === HAB_LAND && !L.pFly[i]) s -= 5;
  if (w.rad[c] > 0.2) s -= 3;
  return s;
}

/** one tick for all creatures */
export function stepCreatures(w) {
  const L = w.life;
  buildBins(L);
  const rng = w.rng;
  const hi = L.hi;
  for (let i = 0; i < hi; i++) if (L.alive[i]) updateCreature(w, L, i, rng);
  // time bubbles: creatures inside live several ticks per tick
  for (const b of w.bubbles) {
    const extra = Math.max(0, Math.round(b.k) - 1);
    if (!extra) continue;
    forCreaturesNear(w, b.x, b.y, b.r, (j) => { for (let e = 0; e < extra && L.alive[j]; e++) updateCreature(w, L, j, rng); });
  }
  if (w.tick % 20 === 0) census(w);
}

function updateCreature(w, L, i, rng) {
  const W = w.W;
  L.age[i] += 1;
  let x = L.x[i], y = L.y[i];
  const c = (y | 0) * W + (x | 0);
  const T = tempAt(w, c);
  const dT = Math.abs(T - L.pTopt[i]) - L.pTol[i];
  let metab = L.pMetab[i] * (dT > 0 ? 1 + dT * 0.14 : 1);
  const ok = habitable(w, L, i, c);
  if (!ok) metab += 0.1;
  if (L.pHab[i] === HAB_LAND && !L.pFly[i] && w.flood[c] > 0.003) metab += 0.12;
  L.energy[i] -= metab;
  if (w.fire[c] && rng.next() < 0.35) { killCreature(w, i, 'disaster'); return; }
  if (w.lava[c] > 0.0004) { killCreature(w, i, 'disaster'); return; }
  if (w.rad[c] > 0.5 && rng.next() < w.rad[c] * 0.05) { killCreature(w, i, 'disaster'); return; }
  if (L.energy[i] <= 0) { killCreature(w, i, 'starved'); return; }
  // pathogens hit the most abundant species hardest ("kill the winner"), keeping diversity
  const pl = L.plague[L.sp[i]];
  if (pl > 0 && rng.next() < pl) { killCreature(w, i, 'disease'); return; }
  if (L.age[i] > L.pMaxAge[i]) { killCreature(w, i, 'old'); return; }

  const diet = L.pDiet[i];
  // ---- decide (every other tick, staggered)
  if (((i + w.tick) & 1) === 0 || !ok) {
    let decided = false;
    const sense = L.pSense[i];
    // hunting
    if (diet > 0.45 && L.energy[i] < L.pEmax[i] * 0.85) {
      let best = -1, bd = 1e9;
      const maxPrey = L.pSize[i] * (1.4 + L.pSocial[i] * 0.8);
      const mySp = L.sp[i];
      forCreaturesNear(w, x, y, sense, (j, d2) => {
        if (j === i || L.sp[j] === mySp || L.pSize[j] > maxPrey) return;
        const cj = (L.y[j] | 0) * W + (L.x[j] | 0);
        if (!L.pFly[i] && !habitable(w, L, i, cj)) return;
        const s = d2 + L.pDef[j] * 3 + L.pDiet[j] * 4;
        if (s < bd) { bd = s; best = j; }
      });
      if (best >= 0) {
        const dx = L.x[best] - x, dy = L.y[best] - y;
        const d = Math.hypot(dx, dy);
        L.dir[i] = Math.atan2(dy, dx);
        decided = true;
        L.cd[i] = Math.max(L.cd[i], 0);
        if (d < 1.1 + L.pSize[i] * 0.3) attack(w, L, i, best, rng);
        else L.chase = i; // sprint this tick
      }
    }
    // fleeing
    if (!decided && diet < 0.7 && ((i + w.tick) & 3) === 0) {
      let fx = 0, fy = 0, threat = false;
      const myDef = L.pDef[i];
      const mySp = L.sp[i];
      forCreaturesNear(w, x, y, sense * 0.8, (j, d2) => {
        if (L.sp[j] === mySp || L.pDiet[j] < 0.5 || L.pPower[j] < myDef * 0.5) return;
        const inv = 1 / (d2 + 0.3);
        fx -= (L.x[j] - x) * inv; fy -= (L.y[j] - y) * inv;
        threat = true;
      });
      if (threat) { L.dir[i] = Math.atan2(fy, fx) + (rng.next() - 0.5) * 0.5; decided = true; }
    }
    // foraging & migration: probe a few directions, smarter creatures probe more; where the
    // ground is grazed bare they look further and keep going (dispersal)
    if (!decided) {
      const bare = w.veg[c] < 0.1 && diet < 0.6;
      const nCand = 2 + Math.floor(L.pIntel[i] * 4) + (bare ? 2 : 0);
      const reach = Math.max(L.pSpeed[i] * 2.5, sense * (bare ? 1.4 : 0.6));
      let bestDir = L.dir[i], bs = probeScore(w, L, i, x + Math.cos(bestDir) * reach, y + Math.sin(bestDir) * reach) + (bare ? 0.6 : 0.3);
      for (let k = 0; k < nCand; k++) {
        const d = k === 0 ? L.dir[i] + 0.9 : k === 1 ? L.dir[i] - 0.9 : rng.next() * TWO_PI;
        const s = probeScore(w, L, i, x + Math.cos(d) * reach, y + Math.sin(d) * reach) + rng.next() * 0.4;
        if (s > bs) { bs = s; bestDir = d; }
      }
      L.dir[i] = bestDir;
      // herding
      const soc = L.pSocial[i] * (L.energy[i] < L.pEmax[i] * 0.55 || bare ? 0.3 : 1);
      if (soc > 0.35 && ((i + w.tick) & 3) === 0) {
        let sx = 0, sy = 0, n = 0;
        const mySp = L.sp[i];
        forCreaturesNear(w, x, y, 3.5, (j) => { if (L.sp[j] === mySp && j !== i) { sx += L.x[j]; sy += L.y[j]; n++; } return n < 8; });
        if (n > 0) {
          const ax = sx / n - x, ay = sy / n - y;
          const da = Math.atan2(ay, ax);
          const k = (soc - 0.35) * 0.7;
          L.dir[i] = Math.atan2(Math.sin(L.dir[i]) * (1 - k) + Math.sin(da) * k, Math.cos(L.dir[i]) * (1 - k) + Math.cos(da) * k);
        }
      }
    }
  }

  // ---- move (resting grazers move slowly)
  let sp = L.pSpeed[i];
  if (diet < 0.45 && w.veg[c] > 0.35 && ok) sp *= 0.5;
  if (L.chase === i) { sp *= 1.35; L.chase = -1; }
  const nx = x + Math.cos(L.dir[i]) * sp, ny = y + Math.sin(L.dir[i]) * sp;
  if (nx >= 0 && ny >= 0 && nx < w.W && ny < w.H) {
    const nc = (ny | 0) * W + (nx | 0);
    if (habitable(w, L, i, nc) || !ok) { x = nx; y = ny; } else L.dir[i] += (rng.next() < 0.5 ? 1 : -1) * (1 + rng.next());
  } else L.dir[i] += Math.PI;
  // portals
  if (w.portals.length && L.tp[i] === 0) {
    for (const p of w.portals) {
      if (Math.abs(x - p.ax) < 0.9 && Math.abs(y - p.ay) < 0.9) { x = p.bx + (rng.next() - 0.5); y = p.by + (rng.next() - 0.5); L.tp[i] = 20; break; }
      if (Math.abs(x - p.bx) < 0.9 && Math.abs(y - p.by) < 0.9) { x = p.ax + (rng.next() - 0.5); y = p.ay + (rng.next() - 0.5); L.tp[i] = 20; break; }
    }
  } else if (L.tp[i] > 0) L.tp[i]--;
  L.x[i] = Math.min(w.W - 0.01, Math.max(0, x));
  L.y[i] = Math.min(w.H - 0.01, Math.max(0, y));

  // ---- eat plants / plankton
  const c2 = (L.y[i] | 0) * W + (L.x[i] | 0);
  if (diet < 0.8) {
    const water = w.elev[c2] < w.seaLevel || w.lake[c2] > 0;
    const canGraze = L.pHab[i] === HAB_AMPHI || (L.pHab[i] === HAB_WATER) === water;
    if (canGraze) {
      const bite = 0.2 * Math.pow(L.pSize[i], 0.75) * (1 - diet * 0.4);
      const v = w.veg[c2];
      const a = v < bite ? v : bite;
      w.veg[c2] = v - a;
      L.energy[i] += a * 0.55 * (1 - diet * Math.sqrt(diet)) * (1 + L.pIntel[i] * 0.35);
    }
  }
  if (L.energy[i] > L.pEmax[i]) L.energy[i] = L.pEmax[i];

  // ---- reproduce
  if (L.cd[i] > 0) L.cd[i]--;
  else if (L.energy[i] > L.pEmax[i] * 0.78 && L.age[i] > L.pMaxAge[i] * 0.14 && L.count < L.cap - 8) {
    // crowding: dense populations stop breeding (territoriality, disease, stress)
    let crowd = 0;
    const mySp = L.sp[i];
    forCreaturesNear(w, L.x[i], L.y[i], 2, (j) => { if (L.sp[j] === mySp) crowd++; return crowd < 6; });
    if (crowd < 6) reproduce(w, L, i, rng);
    else L.cd[i] = 4;
  }
}

function attack(w, L, i, j, rng) {
  // herds defend their members
  let def = L.pDef[j];
  if (L.pSocial[j] > 0.6) {
    let allies = 0;
    const sj = L.sp[j];
    forCreaturesNear(w, L.x[j], L.y[j], 2, (k) => { if (L.sp[k] === sj) allies++; return allies < 6; });
    def *= 1 + Math.min(5, allies) * 0.07 * L.pSocial[j];
  }
  const p = Math.max(0.05, Math.min(0.9, 0.38 + 0.45 * (L.pPower[i] - def) / (L.pPower[i] + def + 0.01)));
  if (rng.next() < p) {
    L.energy[i] += (0.45 + L.pSize[j] * 0.75) * (0.3 + 0.7 * L.pDiet[i]);
    if (L.energy[i] > L.pEmax[i]) L.energy[i] = L.pEmax[i];
    killCreature(w, j, 'eaten');
  } else {
    L.energy[i] -= 0.02;
    // a failed hunt can hurt the hunter when the prey fights back
    if (L.pAggr[j] > 0.6 && rng.next() < 0.2) L.energy[i] -= 0.1 * L.pSize[j];
  }
}

function reproduce(w, L, i, rng) {
  const n = L.pLitter[i];
  const share = (L.energy[i] * 0.5) / n;
  L.energy[i] *= 0.5;
  L.cd[i] = 6 + (3 - n) * 4;
  const s = w.species[L.sp[i]];
  const c = (L.y[i] | 0) * w.W + (L.x[i] | 0);
  const sigma = 0.022 * w.settings.evolution * (1 + w.rad[c] * 6);
  const pDist = geneticDistance(L.gen, i * NG, s.ref, 0);
  for (let k = 0; k < n; k++) {
    const j = allocSlot(L);
    if (j < 0) return;
    mutateInto(L.gen, j * NG, L.gen, i * NG, rng, sigma);
    // echo monoliths nudge minds towards awareness
    for (const m of w.monoliths) {
      if (Math.abs(L.x[i] - m.x) < m.r && Math.abs(L.y[i] - m.y) < m.r) {
        L.gen[j * NG + G.intellect] = Math.min(1, L.gen[j * NG + G.intellect] + 0.014);
        L.gen[j * NG + G.social] = Math.min(1, L.gen[j * NG + G.social] + 0.006);
      }
    }
    let sp = L.sp[i];
    if (pDist > SPECIATION * 0.7) {
      const d = geneticDistance(L.gen, j * NG, s.ref, 0);
      if (d > SPECIATION && w.speciesAliveCount < 150) {
        const ns = createSpecies(w, L.gen, j * NG, s.id, L.x[i], L.y[i], rng);
        sp = ns.id;
        w.speciesAliveCount++;
        if (w.tick > 8) noteNewSpecies(w, ns, s);
      }
    }
    initSlot(w, L, j, sp, L.x[i] + (rng.next() - 0.5) * 0.8, L.y[i] + (rng.next() - 0.5) * 0.8, 0);
    L.energy[j] = share;
    L.stats.births++;
  }
}

function noteNewSpecies(w, ns, parent) {
  w.newSpeciesCount = (w.newSpeciesCount || 0) + 1;
  // the chronicle mentions new species only occasionally, or when they cross a frontier
  const p = parent;
  let msg = null, imp = 1;
  if (p.hab === HAB_WATER && ns.hab !== HAB_WATER && !w.flags.landfall) { w.flags.landfall = true; msg = `${ns.name}从${p.name}中分化而出——生命第一次爬上了陆地。`; imp = 3; }
  else if (ns.fly && !p.fly && !w.flags.flight) { w.flags.flight = true; msg = `${ns.name}从${p.name}中分化而出，生命第一次飞上了天空。`; imp = 3; }
  else if (w.newSpeciesCount % 12 === 0) msg = `新物种${ns.name}（${ns.latin}）从${p.name}中分化而出。`;
  if (msg) log(w, 'life', msg, { imp, x: ns.x, y: ns.y });
  if (w.newSpeciesCount === 100 || w.newSpeciesCount === 500) log(w, 'life', `自创世以来，已有 ${w.newSpeciesCount} 个物种诞生。`, { imp: 2 });
}

/** recompute species reference genomes, populations and centroids; detect awakenings */
export function census(w) {
  const L = w.life;
  const nS = w.species.length;
  const sums = new Float64Array(nS * NG);
  const cnt = new Int32Array(nS);
  const sx = new Float64Array(nS), sy = new Float64Array(nS);
  for (let i = 0; i < L.hi; i++) {
    if (!L.alive[i]) continue;
    const s = L.sp[i];
    cnt[s]++;
    sx[s] += L.x[i]; sy[s] += L.y[i];
    const o = i * NG, so = s * NG;
    for (let k = 0; k < NG; k++) sums[so + k] += L.gen[o + k];
  }
  let alive = 0;
  if (L.plague.length < nS) { const p = new Float32Array(nS * 2); p.set(L.plague); L.plague = p; }
  const crowded = Math.max(0, L.count / L.cap - 0.7) * 0.06;
  for (let s = 0; s < nS; s++) {
    L.plague[s] = Math.min(0.03, Math.max(0, cnt[s] / L.cap - 0.12) * 0.05) + crowded;
    const sp = w.species[s];
    if (sp.extinct !== null) continue;
    sp.pop = cnt[s];
    if (cnt[s] === 0) { markExtinct(w, sp); continue; }
    alive++;
    for (let k = 0; k < NG; k++) sp.ref[k] = sums[s * NG + k] / cnt[s];
    sp.x = sx[s] / cnt[s]; sp.y = sy[s] / cnt[s];
    if (w.tick % 40 === 0) {
      sp.hist.push([w.tick, cnt[s]]);
      if (sp.hist.length > 400) sp.hist = sp.hist.filter((_, k) => k % 2 === 0 || k === sp.hist.length - 1);
    }
    // awakening: a clever, social, land-dwelling species becomes sapient
    if (!sp.sapient && sp.hab !== HAB_WATER && cnt[s] >= 10 && sp.ref[G.intellect] >= 0.7 && sp.ref[G.social] >= 0.45) {
      sp.sapient = true;
      w.awakenings.push({ sp: s, x: sp.x, y: sp.y });
    }
  }
  w.speciesAliveCount = alive;
}

/** consume catastrophes: kill creatures caught in them */
export function applyImpactsToLife(w, impacts) {
  const L = w.life;
  for (const im of impacts) {
    let p = 0;
    switch (im.kind) {
      case 'meteor': p = 1; break;
      case 'nuke': p = 1; break;
      case 'eruption': p = 0.8; break;
      case 'lava': p = 0.9; break;
      case 'tsunami': p = 0.35; break;
      case 'quake': p = 0.05; break;
      case 'smite': p = 1; break;
      default: p = 0;
    }
    if (!p) continue;
    forCreaturesNear(w, im.x, im.y, im.r, (j) => {
      if (im.kind === 'tsunami') {
        const c = (L.y[j] | 0) * w.W + (L.x[j] | 0);
        if (L.pHab[j] === HAB_WATER || w.flood[c] < 0.001) return;
      }
      if (w.rng.next() < p) killCreature(w, j, 'disaster');
    });
  }
}

/** a creature's genome as a plain array (for the inspector and the species designer) */
export function genomeOf(w, i) {
  return Array.from(w.life.gen.subarray(i * NG, i * NG + NG));
}

export function findCreatureAt(w, x, y, r = 1.2) {
  let best = -1, bd = r * r;
  forCreaturesNear(w, x, y, r, (j, d2) => { if (d2 < bd) { bd = d2; best = j; } });
  return best;
}

export function burst(w, x, y, color) {
  pushFx(w, { type: 'sparkle', x, y, color });
}

/** populate a fresh world. mode: 'none' | 'primordial' (only simple sea life) | 'flourishing' */
export function seedLife(w, mode, rng) {
  if (mode === 'none') return;
  // [archetype, groups, individuals per group, seed near the homes of this archetype]
  const plan = mode === 'primordial'
    ? [['plankton', 3, 40], ['grazerFish', 3, 30]]
    : [['plankton', 4, 40], ['grazerFish', 3, 30], ['hunterFish', 2, 12, 'grazerFish'], ['newt', 2, 20], ['grazer', 3, 30], ['critter', 2, 30],
      ['predator', 2, 8, 'grazer'], ['bird', 2, 20], ['behemoth', 1, 10], ['primate', 1, 18], ['frostBeast', 1, 20], ['desertLizard', 1, 20]];
  const homes = {};
  for (const [key, groups, n, nearKey] of plan) {
    const arch = ARCHETYPES[key];
    let parent = -1;
    homes[key] = [];
    for (let gI = 0; gI < groups; gI++) {
      const near = nearKey && homes[nearKey] && homes[nearKey].length ? { ...homes[nearKey][gI % homes[nearKey].length], r: 8 } : null;
      const home = findHome(w, arch.genes, rng, 400, near) || (near ? findHome(w, arch.genes, rng) : null);
      if (!home) continue;
      homes[key].push(home);
      // later groups of the same archetype belong to the first group's species
      if (parent < 0) parent = seedPopulation(w, arch.genes, home.x, home.y, n, 5, rng, arch.name).id;
      else seedMore(w, parent, arch.genes, home.x, home.y, n, 5, rng);
    }
  }
}

function seedMore(w, spId, genes, x, y, n, radius, rng) {
  const g = Float32Array.from(genes);
  phenotype(g, 0, tmpT);
  const tmp = new Float32Array(NG);
  radius = Math.max(radius, Math.sqrt(n) * 1.7);
  let placed = 0;
  for (let k = 0; k < n * 6 && placed < n; k++) {
    const a = rng.next() * TWO_PI, r = Math.sqrt(rng.next()) * radius;
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    if (px < 0 || py < 0 || px >= w.W || py >= w.H) continue;
    if (!canLive(w, tmpT.hab, tmpT.fly, (py | 0) * w.W + (px | 0))) continue;
    mutateInto(tmp, 0, g, 0, rng, 0.02);
    if (spawnCreature(w, spId, tmp, 0, px, py, 0.7) >= 0) placed++;
  }
}
