// Molecule presets (approximate geometries in Å) and CPK styling.
const deg = Math.PI / 180;

function ring(n, r, z = 0, phase = 0) { return Array.from({ length: n }, (_, i) => [r * Math.cos(phase + (i / n) * 2 * Math.PI), r * Math.sin(phase + (i / n) * 2 * Math.PI), z]); }

export const ELEMENTS = {
  H: { color: '#f2f2f2', r: 0.3 }, C: { color: '#4a4a4a', r: 0.42 }, N: { color: '#3d63f5', r: 0.4 }, O: { color: '#ff3b30', r: 0.4 },
  P: { color: '#ff8c1a', r: 0.48 }, S: { color: '#ffd43b', r: 0.5 }, Cl: { color: '#2fd158', r: 0.5 }, F: { color: '#8ce99a', r: 0.36 },
};

export function moleculePreset(name) {
  switch (name) {
    case 'water': return { atoms: [['O', 0, 0, 0], ['H', 0.757, 0.586, 0], ['H', -0.757, 0.586, 0]], bonds: [[0, 1, 1], [0, 2, 1]] };
    case 'co2': return { atoms: [['C', 0, 0, 0], ['O', 1.16, 0, 0], ['O', -1.16, 0, 0]], bonds: [[0, 1, 2], [0, 2, 2]] };
    case 'methane': { const k = 0.629; return { atoms: [['C', 0, 0, 0], ['H', k, k, k], ['H', -k, -k, k], ['H', -k, k, -k], ['H', k, -k, -k]], bonds: [[0, 1, 1], [0, 2, 1], [0, 3, 1], [0, 4, 1]] }; }
    case 'ethanol': return {
      atoms: [['C', -1.2, -0.25, 0], ['C', 0.25, 0.3, 0], ['O', 1.25, -0.65, 0], ['H', 2.05, -0.15, 0], ['H', -1.85, 0.6, 0.1], ['H', -1.35, -0.9, 0.85], ['H', -1.4, -0.85, -0.85], ['H', 0.35, 0.95, 0.88], ['H', 0.35, 0.95, -0.88]],
      bonds: [[0, 1, 1], [1, 2, 1], [2, 3, 1], [0, 4, 1], [0, 5, 1], [0, 6, 1], [1, 7, 1], [1, 8, 1]],
    };
    case 'benzene': {
      const C = ring(6, 1.39, 0, 30 * deg), H = ring(6, 2.47, 0, 30 * deg);
      return { atoms: [...C.map((p) => ['C', ...p]), ...H.map((p) => ['H', ...p])], bonds: [...C.map((_, i) => [i, (i + 1) % 6, i % 2 ? 1 : 2]), ...C.map((_, i) => [i, i + 6, 1])] };
    }
    case 'glucose': {
      const R = ring(6, 1.45, 0, 0).map((p, i) => [p[0], p[1], i % 2 ? 0.25 : -0.25]);
      const els = ['O', 'C', 'C', 'C', 'C', 'C'];
      const atoms = R.map((p, i) => [els[i], ...p]);
      const bonds = R.map((_, i) => [i, (i + 1) % 6, 1]);
      [1, 2, 3, 4].forEach((ci, k) => { const p = R[ci]; const L = Math.hypot(p[0], p[1]); atoms.push(['O', (p[0] / L) * 2.6, (p[1] / L) * 2.6, k % 2 ? 0.6 : -0.6]); bonds.push([ci, atoms.length - 1, 1]); });
      const p5 = R[5], L5 = Math.hypot(p5[0], p5[1]);
      atoms.push(['C', (p5[0] / L5) * 2.7, (p5[1] / L5) * 2.7, 0.5]); bonds.push([5, atoms.length - 1, 1]);
      atoms.push(['O', (p5[0] / L5) * 3.9, (p5[1] / L5) * 3.4, 0.2]); bonds.push([atoms.length - 2, atoms.length - 1, 1]);
      return { atoms, bonds };
    }
    case 'dna': {
      const atoms = [], bonds = [];
      const n = 20, rise = 0.34 * 2.2, R = 2.2;
      let prevA = -1, prevB = -1;
      for (let i = 0; i < n; i++) {
        const a = i * 36 * deg, z = i * rise - (n * rise) / 2;
        atoms.push(['P', R * Math.cos(a), R * Math.sin(a), z]);
        const ia = atoms.length - 1;
        atoms.push(['P', R * Math.cos(a + 150 * deg), R * Math.sin(a + 150 * deg), z]);
        const ib = atoms.length - 1;
        const els = ['N', 'C', 'O', 'N'];
        const mid = [(atoms[ia][1] + atoms[ib][1]) / 2, (atoms[ia][2] + atoms[ib][2]) / 2];
        atoms.push([els[i % 4], (atoms[ia][1] + mid[0]) / 2, (atoms[ia][2] + mid[1]) / 2, z]);
        atoms.push([els[(i + 2) % 4], (atoms[ib][1] + mid[0]) / 2, (atoms[ib][2] + mid[1]) / 2, z]);
        const ba = atoms.length - 2, bb = atoms.length - 1;
        bonds.push([ia, ba, 1], [ba, bb, 1], [bb, ib, 1]);
        if (prevA >= 0) bonds.push([prevA, ia, 1], [prevB, ib, 1]);
        prevA = ia; prevB = ib;
      }
      return { atoms, bonds, scale: 1.15 };
    }
    case 'caffeine':
    default: return {
      atoms: [
        ['N', 0, 1.4, 0], ['C', 1.21, 0.7, 0], ['N', 1.21, -0.7, 0], ['C', 0, -1.4, 0], ['C', -1.21, -0.7, 0], ['C', -1.21, 0.7, 0],
        ['N', -2.45, -1.2, 0], ['C', -2.3, -2.55, 0], ['N', -0.95, -2.75, 0],
        ['O', 2.35, 1.35, 0], ['O', -2.35, 1.35, 0], ['C', 0, 2.85, 0], ['C', 2.45, -1.4, 0], ['C', -3.7, -0.5, 0], ['H', -3.1, -3.3, 0],
        ['H', 0.95, 3.25, 0.4], ['H', -0.95, 3.25, 0.4], ['H', 0, 3.2, -0.95], ['H', 3.3, -0.75, 0.2], ['H', 2.55, -2.1, 0.8], ['H', 2.55, -2.0, -0.85],
        ['H', -4.55, -1.15, 0.2], ['H', -3.75, 0.15, 0.85], ['H', -3.85, 0.1, -0.85],
      ],
      bonds: [[0, 1, 1], [1, 2, 1], [2, 3, 1], [3, 4, 2], [4, 5, 1], [5, 0, 1], [4, 6, 1], [6, 7, 1], [7, 8, 2], [8, 3, 1], [1, 9, 2], [5, 10, 2], [0, 11, 1], [2, 12, 1], [6, 13, 1], [7, 14, 1], [11, 15, 1], [11, 16, 1], [11, 17, 1], [12, 18, 1], [12, 19, 1], [12, 20, 1], [13, 21, 1], [13, 22, 1], [13, 23, 1]],
    };
  }
}
