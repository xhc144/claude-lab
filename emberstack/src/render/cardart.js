// Illustrations for every card: a backdrop matched to the card's kind plus a subject composed from
// the painter vocabulary. Coordinates are in the 100×76 art window.

import { CARDS } from '../data/cards.js';
import { INK, lighten, darken } from './paint.js';
import { figure, item, flame, quadruped, bird, fish, shade, wisp, golem, treebeast, tentacle, beetle, serpent } from './art_life.js';
import {
  tree, pine, deadTree, bush, grass, wheat, mushroom, herbs, reeds, rocks, crystal, pit, pool, fireRing, hut, tower, post, anvil,
  furnace, tent, wall, logs, planks, bricks, ingot, ore, pile, sack, jar, bottle, plate, bowl, coin, scroll, book, gearShape,
  chest, boat, cart, grave,
} from './art_world.js';

// ---------------------------------------------------------------- backdrops -----------------------
const BG = {
  dusk: (P) => { P.sky('#3a2a3a', '#c8774a', 60); P.hills('#4a3a32', 58, 6, 4, 1); P.ground('#5a4232', 60); },
  day: (P) => { P.sky('#8fb4c8', '#e8d6a8', 58); P.hills('#7a9a5a', 54, 7, 4, 2); P.hills('#5f8040', 60, 5, 5, 3); P.ground('#6a8a46', 62); },
  meadow: (P) => { P.sky('#a4c0c8', '#efdcb0', 56); P.hills('#8aa860', 52, 6, 3, 4); P.ground('#7a9a4e', 60); },
  forest: (P) => { P.sky('#3e5a46', '#a8b48a', 58); P.treeline('#2e4632', 50, 16, 5); P.treeline('#253a2a', 58, 10, 6); P.ground('#4a5e34', 62); P.fog(52, 0.25); },
  night: (P) => { P.sky('#0e1426', '#2a3150', 60); P.stars(22); P.hills('#1a1e2a', 58, 6, 4, 7); P.ground('#1e1c22', 62); },
  cave: (P) => { P.spot('#5a4a3e', '#1a120e'); P.ground('#3a2e26', 62); P.vignette(0.6); },
  interior: (P) => { P.rect(-2, -2, 104, 80).vfill('#5a3e28', '#3a2618', 0, 60); for (let i = 0; i < 6; i++) P.line(-2, 8 + i * 10, 102, 8 + i * 10, 0.6, 'rgba(20,10,5,0.35)'); P.table(58, '#6a4325'); P.halo(70, 20, 50, 'rgba(255,180,90,1)', 0.25); },
  table: (P) => { P.spot('#c9a878', '#6a4a30'); P.table(56, '#6a4325'); P.halo(40, 30, 60, 'rgba(255,220,160,1)', 0.25); },
  parch: (P) => { P.spot('#ecdcb4', '#b89a6a'); for (let i = 0; i < 9; i++) P.line(0, 8 + i * 8, 100, 8 + i * 8, 0.4, 'rgba(90,60,30,0.12)'); for (let i = 0; i < 13; i++) P.line(8 + i * 8, 0, 8 + i * 8, 76, 0.4, 'rgba(90,60,30,0.12)'); },
  steel: (P) => { P.spot('#c8ccd0', '#5a6068'); P.vignette(0.3); },
  snow: (P) => { P.sky('#a8c0d8', '#e8eef2', 56); P.mountains('#8aa0b8', 50, 22, 3, 8, true); P.ground('#e6eef2', 60, '#b8c8d4'); },
  sea: (P) => { P.sky('#8ab0c8', '#e8dcc0', 46); P.water(46, '#4a8a9a', '#1e4a58'); },
  shore: (P) => { P.sky('#9ab8c8', '#efe0c0', 44); P.water(44, '#4a8a9a', '#2a5a68'); P.path((c) => { c.moveTo(-2, 78); c.lineTo(-2, 62); c.quadraticCurveTo(40, 54, 102, 64); c.lineTo(102, 78); c.closePath(); }).vfill('#e2cc96', '#b89a62', 56, 78); },
  marsh: (P) => { P.sky('#6a8a84', '#c8c8a8', 56); P.ground('#4a5a40', 58); for (let i = 0; i < 3; i++) P.ellipse(20 + i * 30, 66 + (i % 2) * 4, 14, 3).fill('rgba(90,130,130,0.7)'); P.fog(56, 0.35); },
  mountain: (P) => { P.sky('#8aa0b8', '#e2d4b4', 56); P.mountains('#7a7068', 54, 30, 3, 9, true); P.ground('#7a6a54', 60); },
  ash: (P) => { P.sky('#2a1e1e', '#8a4a32', 58); P.hills('#2e2624', 56, 6, 5, 11); P.ground('#3a302c', 60); for (let i = 0; i < 14; i++) P.circle(P.r() * 100, P.r() * 60, 0.5 + P.r() * 0.6).fill('rgba(255,140,60,0.7)'); },
  blood: (P) => { P.spot('#6a2a26', '#1a0c0c'); P.fog(60, 0.25, '140,60,60'); P.ground('#2a1614', 64); P.vignette(0.55); },
  shadow: (P) => { P.spot('#4a3a62', '#120c1c'); P.fog(56, 0.35, '120,90,160'); P.vignette(0.6); },
  deep: (P) => { P.spot('#2e4a72', '#0c1424'); P.stars(26, 76); for (let i = 0; i < 4; i++) P.line(10 + i * 22, 10 + (i % 2) * 12, 22 + i * 22, 18 - (i % 2) * 6, 0.5, 'rgba(200,220,255,0.35)'); },
  gold: (P) => { P.spot('#f2d68a', '#8a5a1e'); P.rays(50, 40, 14, 70, 'rgba(255,240,190,0.18)', 6); },
  ember: (P) => { P.spot('#7a3a1e', '#1a0a06'); P.halo(50, 44, 50, 'rgba(255,140,50,1)', 0.35); },
  mist: (P) => { P.sky('#7a8a96', '#d0ccc0', 60); P.water(54, '#5a7a86', '#2a4048'); P.fog(50, 0.5); P.fog(36, 0.35); },
};

const KIND_BG = {
  folk: 'dusk', food: 'table', resource: 'table', node: 'meadow', structure: 'dusk', tool: 'parch', gear: 'steel', beast: 'meadow',
  enemy: 'blood', lair: 'blood', region: 'meadow', knowledge: 'deep', coin: 'gold', bundle: 'table', event: 'dusk', wonder: 'ember', misc: 'dusk',
};

// ---------------------------------------------------------------- people --------------------------
const FOLK = {
  survivor: { robe: '#7a5a3a', hat: 'hood', hatColor: '#5a4632' },
  child: { robe: '#a8703a', scale: 0.72 },
  woodsman: { robe: '#5a6a3a', item: 'axe', hat: 'cap', hatColor: '#6a3a22', beard: '#3a2414' },
  miner: { robe: '#5a5048', item: 'pick', hat: 'helmet', hatColor: '#9a8a5a' },
  farmer: { robe: '#8a7a42', item: 'hoe', hat: 'straw' },
  artisan: { robe: '#6a4a6a', item: 'wrench', hat: 'band', hatColor: '#3a5a7a' },
  scholar: { robe: '#2e3e62', robe2: '#c9a45a', item: 'book', hat: 'scholar', hatColor: '#1e2a44' },
  healer: { robe: '#e2d8c0', robe2: '#5a8a4a', item: 'herbs', hat: 'band', hatColor: '#5a8a4a' },
  scout: { robe: '#4a5a42', cape: '#3a4a32', item: 'map', hat: 'hood', hatColor: '#3a4a32' },
  merchant: { robe: '#8a3a2a', robe2: '#d9a83a', item: 'scale', hat: 'cap', hatColor: '#5a2a1a' },
  lampwarden: { robe: '#3a3a52', cape: '#2a2a3e', item: 'lantern', hat: 'hood', hatColor: '#2a2a3e', glow: 'rgba(255,200,110,1)', glowAt: [16, -16] },
  spearman: { robe: '#6a4a32', item: 'spear', hat: 'helmet', hatColor: '#7a6a52' },
  archer: { robe: '#4a6a3a', item: 'bow', hat: 'hood', hatColor: '#3a5a2a' },
  maceguard: { robe: '#5a5a62', item: 'mace', hat: 'helmet', hatColor: '#8a929a', shield: true },
  knight: { robe: '#7a8492', robe2: '#a8323a', cape: '#8a2a2a', item: 'spear', hat: 'helmet', hatColor: '#a8b0b8' },
  musketeer: { robe: '#3a4a6a', robe2: '#c9a45a', item: 'musket', hat: 'cap', hatColor: '#2a2a3a' },
  sage: { robe: '#e8e0cc', robe2: '#3a5a8a', item: 'staff', beard: '#e8e8e8', hair: '#d8d8d8', glow: 'rgba(255,230,160,1)', glowAt: [16, -50] },
  engineer: { robe: '#5a4a3a', robe2: '#8a8a8a', item: 'wrench', hat: 'cog' },
  sailor: { robe: '#3a5a7a', robe2: '#e8e8e8', item: 'compass', hat: 'cap', hatColor: '#2a3a5a' },
  flamekeeper: { robe: '#8a2e1e', robe2: '#e8b84a', cape: '#5a1a12', item: 'flame', hat: 'flame', glow: 'rgba(255,170,60,1)', glowAt: [17, -32] },
  automaton: null,
};

function drawFolk(P, id) {
  const o = FOLK[id];
  if (id === 'automaton') {
    P.at(50, 74, 1, 0, () => {
      P.shadow(0, 0, 18, 4);
      P.rect(-12, -40, 24, 30, 3).lfill('#8a7a5a', -12, -40, 12, -10, 0.4).ink(1.2);
      gearShape(P, 0, -26, 0.55, '#c9a45a');
      P.rect(-8, -56, 16, 14, 3).lfill('#9a8a6a', -8, -56, 8, -42, 0.4).ink(1.2);
      P.halo(-3, -50, 4, 'rgba(120,220,255,1)', 1);
      P.halo(3, -50, 4, 'rgba(120,220,255,1)', 1);
      P.rect(-10, -10, 7, 10, 1).fill('#5a5040').ink(1);
      P.rect(3, -10, 7, 10, 1).fill('#5a5040').ink(1);
      P.line(-12, -36, -20, -20, 4, '#6a5a42');
      P.line(12, -36, 20, -20, 4, '#6a5a42');
      P.line(0, -56, 0, -62, 1);
      P.circle(0, -63, 1.6).fill('#ff7a3a');
    });
    return;
  }
  if (id === 'child') {
    figure(P, 40, 72, 0.7, { robe: '#a8703a', hair: '#3a2414' });
    figure(P, 64, 72, 0.62, { robe: '#5a7a9a', hair: '#5a3a24' });
    return;
  }
  const s = 1.02;
  figure(P, 48, 74, s, { ...o, skin: undefined });
  if (o.shield) P.at(48, 74, s, 0, () => item(P, 'shield', 'hold'));
}

// ---------------------------------------------------------------- per-card art --------------------
const A = Object.create(null);

// food -------------------------------------------------------------------------------------------
A.berry = (P) => { for (const [x, y] of [[40, 50], [52, 46], [60, 54], [46, 58], [56, 62], [36, 60], [64, 46]]) { P.circle(x, y, 5.5).lfill('#b0283a', x - 5, y - 5, x + 5, y + 5, 0.4).ink(0.9); P.circle(x - 1.6, y - 1.6, 1.2).fill('rgba(255,255,255,0.6)'); } P.path((c) => { c.moveTo(50, 44); c.quadraticCurveTo(54, 30, 64, 28); }).ink(1.4, '#4a6a2a'); P.ellipse(64, 30, 7, 3, -0.4).fill('#5a8a3a').ink(0.8); };
A.apple = (P) => { for (const [x, y] of [[40, 56], [60, 56], [50, 44]]) { P.circle(x, y, 10).lfill('#c2402a', x - 10, y - 10, x + 10, y + 10, 0.4).ink(1.1); P.curve(x, y - 9, x + 1, y - 13, x + 3, y - 15, 1.2, '#4a2a14'); P.ellipse(x + 5, y - 13, 4, 2, -0.4).fill('#5a8a3a').ink(0.7); P.curve(x - 5, y - 4, x - 6, y, x - 4, y + 4, 1, 'rgba(255,255,255,0.45)'); } };
A.mushroom = (P) => { mushroom(P, 38, 62, 1.6, '#b84a2a'); mushroom(P, 62, 64, 1.2, '#c8862a'); mushroom(P, 52, 70, 0.9, '#b84a2a'); };
A.root = (P) => { for (const [x, y, r] of [[40, 56, -0.4], [58, 58, 0.3], [50, 48, 0]]) P.at(x, y, 1, r, () => { P.ellipse(0, 0, 13, 7).lfill('#b0784a', -13, -7, 13, 7, 0.3).ink(1); for (let i = 0; i < 3; i++) P.line(-6 + i * 5, -4, -5 + i * 5, 4, 0.5, 'rgba(60,30,10,0.5)'); P.curve(12, 0, 18, -2, 20, 2, 0.8); }); };
A.raw_fish = (P) => { P.table(58, '#5a4a3a'); fish(P, 50, 46, 1.6, { color: '#7aa6b8' }); };
A.cooked_fish = (P) => { plate(P, 50, 60, 1.1); fish(P, 50, 50, 1.5, { cooked: true }); P.curve(44, 36, 40, 28, 46, 20, 1.4, 'rgba(255,255,255,0.35)'); };
A.raw_meat = (P) => { P.table(58, '#5a4a3a'); P.blob([30, 50, 40, 36, 62, 34, 72, 46, 64, 62, 40, 62]).lfill('#c0454a', 30, 34, 72, 62, 0.3).ink(1.2); P.curve(40, 44, 54, 40, 64, 46, 2, 'rgba(255,230,220,0.7)'); P.curve(38, 54, 50, 52, 62, 56, 1.4, 'rgba(255,230,220,0.6)'); };
A.roast = (P) => { plate(P, 50, 62, 1.1); P.blob([30, 54, 34, 40, 50, 36, 60, 44, 56, 56, 40, 60]).lfill('#9a4a1e', 30, 36, 60, 60, 0.35).ink(1.2); P.rect(58, 42, 16, 5, 2.5).fill('#efe3c8').ink(0.9); P.circle(74, 41, 3).fill('#efe3c8').ink(0.8); P.circle(74, 48, 3).fill('#efe3c8').ink(0.8); P.curve(40, 30, 36, 22, 42, 14, 1.4, 'rgba(255,255,255,0.35)'); };
A.egg = (P) => { P.table(60, '#5a4a3a'); for (const [x, y] of [[42, 54], [58, 56], [50, 46]]) P.ellipse(x, y, 7, 9).lfill('#efe6d0', x - 7, y - 9, x + 7, y + 9, 0.25).ink(1); };
A.grain = (P) => { wheat(P, 50, 70, 1.6, 8); P.rect(38, 56, 24, 4, 1).fill('#a8783a').ink(0.8); };
A.bread = (P) => { P.table(60, '#5a4a3a'); P.path((c) => { c.moveTo(24, 58); c.quadraticCurveTo(26, 34, 50, 32); c.quadraticCurveTo(74, 34, 76, 58); c.closePath(); }).lfill('#c88a3e', 24, 32, 76, 58, 0.35).ink(1.2); for (let i = 0; i < 3; i++) P.curve(34 + i * 12, 40, 38 + i * 12, 44, 40 + i * 12, 50, 1.4, 'rgba(120,60,20,0.7)'); };
A.stew = (P) => { bowl(P, 50, 62, 1.4, '#a85a2a'); };
A.jerky = (P) => { P.table(60, '#5a4a3a'); for (let i = 0; i < 4; i++) P.at(34 + i * 10, 48, 1, (i - 1.5) * 0.15, () => P.rect(-3.5, -12, 7, 26, 2).lfill('#7a3020', -4, -12, 4, 14).ink(0.9)); P.line(28, 36, 72, 36, 1, '#a88a5a'); };
A.salted_fish = (P) => { P.table(60, '#5a4a3a'); fish(P, 50, 48, 1.4, { color: '#a8a088' }); for (let i = 0; i < 14; i++) P.rect(30 + P.r() * 40, 40 + P.r() * 16, 1.4, 1.4).fill('#fff'); };
A.milk = (P) => { jar(P, 50, 66, 1.4, '#d8cfc0', '#f6f2ea'); };
A.cheese = (P) => { P.table(60, '#5a4a3a'); P.path((c) => { c.moveTo(26, 56); c.lineTo(26, 44); c.lineTo(66, 34); c.lineTo(74, 44); c.lineTo(74, 56); c.closePath(); }).lfill('#e8c45a', 26, 34, 74, 56, 0.3).ink(1.2); for (const [x, y, r] of [[40, 50, 3], [56, 48, 2.4], [64, 52, 2]]) P.circle(x, y, r).fill('#c89a3a').ink(0.5); };
A.honey = (P) => { jar(P, 50, 66, 1.4, '#c98a2a', '#f0b83a', { cloth: '#d9c8a0', band: '#8a5a2a' }); P.halo(50, 50, 20, 'rgba(255,190,80,1)', 0.25); };
A.jam = (P) => { jar(P, 50, 66, 1.4, '#9a2a3a', '#c43a4a', { cloth: '#e8dcc0', label: true }); };
A.pie = (P) => { P.table(62, '#5a4a3a'); P.ellipse(50, 52, 26, 10).lfill('#c88a3e', 24, 42, 76, 62, 0.3).ink(1.2); for (let i = 0; i < 5; i++) P.line(30 + i * 10, 46, 34 + i * 9, 58, 1.4, '#9a5a24'); P.ellipse(50, 50, 10, 4).fill('#9a2a3a'); };
A.mussel = (P) => { P.table(62, '#4a4a4a'); for (const [x, y, r] of [[40, 52, -0.5], [58, 54, 0.4], [50, 44, 0.1]]) P.at(x, y, 1, r, () => { P.ellipse(0, 0, 10, 6).lfill('#2a3a5a', -10, -6, 10, 6, 0.4).ink(1); for (let i = 0; i < 3; i++) P.curve(-8, -2 + i * 2, 0, -4 + i * 2, 8, -2 + i * 2, 0.4, 'rgba(200,220,255,0.4)'); }); };
A.cooked_mussel = (P) => { plate(P, 50, 60, 1.1); for (const [x, y] of [[40, 52], [58, 54], [50, 46]]) { P.ellipse(x, y, 9, 5).fill('#2a3a5a').ink(0.9); P.ellipse(x, y - 1, 6, 3).fill('#e88a5a'); } };
A.feast = (P) => { P.table(56, '#6a3a20'); plate(P, 30, 58, 0.7); A.roast_small(P, 30, 54); bowl(P, 66, 60, 0.8); jar(P, 50, 56, 0.8, '#8a5a32'); for (const [x, y] of [[44, 64], [56, 66]]) P.circle(x, y, 3).fill('#c2402a').ink(0.7); P.halo(50, 30, 40, 'rgba(255,210,120,1)', 0.25); };
A.roast_small = (P, x, y) => { P.ellipse(x, y, 9, 6).lfill('#9a4a1e', x - 9, y - 6, x + 9, y + 6).ink(1); };
A.mead = (P) => { P.table(62, '#5a4a3a'); P.path((c) => { c.moveTo(36, 30); c.lineTo(64, 30); c.lineTo(60, 64); c.lineTo(40, 64); c.closePath(); }).lfill('#8a5a32', 36, 30, 64, 64).ink(1.2); P.ellipse(50, 30, 14, 3.4).fill('#f0d070').ink(0.9); P.path((c) => { c.moveTo(64, 38); c.quadraticCurveTo(74, 42, 64, 54); }).ink(2.4, '#6a4428'); };
A.herb_tea = (P) => { P.table(62, '#5a4a3a'); P.path((c) => { c.moveTo(34, 42); c.quadraticCurveTo(34, 62, 50, 62); c.quadraticCurveTo(66, 62, 66, 42); c.closePath(); }).lfill('#d9cdb0', 34, 42, 66, 62).ink(1.1); P.ellipse(50, 42, 16, 4).fill('#8a9a4a').ink(0.9); for (let i = 0; i < 3; i++) P.curve(42 + i * 7, 36, 38 + i * 7, 28, 44 + i * 7, 20, 1.3, 'rgba(255,255,255,0.4)'); };
A.roast_root = (P) => { plate(P, 50, 60, 1.1); for (const [x, y] of [[42, 52], [58, 52]]) P.ellipse(x, y, 10, 6).lfill('#8a4a20', x - 10, y - 6, x + 10, y + 6).ink(1); };
A.roast_mushroom = (P) => { plate(P, 50, 62, 1.1); P.line(30, 52, 72, 46, 1.4, '#8a5a32'); for (let i = 0; i < 3; i++) mushroom(P, 38 + i * 12, 56 - i * 2, 0.9, '#7a3a1a'); };
A.salt_roast = (P) => { plate(P, 50, 62, 1.1); P.blob([28, 56, 32, 42, 52, 38, 70, 44, 72, 56, 50, 60]).lfill('#e8e0d0', 28, 38, 72, 60, 0.2).ink(1.2); P.path((c) => { c.moveTo(40, 46); c.lineTo(48, 52); c.lineTo(58, 44); }).ink(1.4, '#9a4a1e'); };
A.rot = (P) => { P.table(62, '#3a3a2a'); P.blob([30, 58, 34, 44, 50, 42, 66, 46, 70, 58]).lfill('#5a5a32', 30, 42, 70, 58).ink(1.1); for (let i = 0; i < 8; i++) P.circle(36 + P.r() * 28, 46 + P.r() * 10, 1 + P.r() * 1.6).fill('#9aa060'); for (let i = 0; i < 2; i++) P.curve(44 + i * 10, 40, 40 + i * 10, 30, 46 + i * 10, 22, 1.2, 'rgba(150,170,90,0.5)'); };

// resources --------------------------------------------------------------------------------------
A.wood = (P) => { logs(P, 52, 60, 1.25); };
A.stone = (P) => { rocks(P, 50, 64, 1.0, '#9a948a', { set: [[-12, -2, 10, 9], [10, -2, 10, 8], [0, -10, 9, 9]] }); };
A.flint = (P) => { P.table(62, '#5a4a3a'); for (const [x, y, r] of [[40, 52, -0.4], [60, 50, 0.5]]) P.at(x, y, 1, r, () => { P.poly([-12, 4, -4, -10, 10, -6, 12, 6, 0, 8]).lfill('#3a3a42', -12, -10, 12, 8, 0.45).ink(1.1); P.line(-4, -6, 6, -3, 0.6, 'rgba(255,255,255,0.5)'); }); P.halo(50, 44, 6, 'rgba(255,220,120,1)', 0.9); };
A.fiber = (P) => { P.at(50, 50, 1, 0.3, () => { for (let i = 0; i < 12; i++) P.curve(-24, -4 + i * 0.7, 0, -8 + i * 1.2, 24, -2 + i * 0.6, 0.9, i % 2 ? '#b8a860' : '#a89a50'); P.rect(-4, -8, 8, 12, 1).fill('#7a5a32').ink(0.8); }); };
A.resin = (P) => { P.table(62, '#4a3a2a'); for (const [x, y, r] of [[42, 50, 7], [58, 54, 6], [50, 40, 5]]) { P.halo(x, y, r * 1.8, 'rgba(255,180,60,1)', 0.35); P.path((c) => { c.moveTo(x, y - r * 1.4); c.quadraticCurveTo(x + r, y, x, y + r); c.quadraticCurveTo(x - r, y, x, y - r * 1.4); }).lfill('#d98a2a', x - r, y - r, x + r, y + r, 0.4).ink(0.9); } };
A.sapling = (P) => { P.ground('#6a5232', 60); P.ellipse(50, 62, 14, 4).fill('#4a3422'); P.curve(50, 62, 48, 46, 52, 32, 1.6, '#5a7a2a'); for (const [x, y, r] of [[44, 40, -0.6], [56, 36, 0.6], [48, 30, -0.3]]) P.ellipse(x, y, 7, 3.4, r).lfill('#6a9a3a', x - 7, y - 3, x + 7, y + 3).ink(0.8); };
A.hide = (P) => { P.blob([26, 40, 36, 26, 54, 30, 70, 24, 76, 40, 70, 58, 52, 54, 34, 60]).lfill('#a8784a', 26, 24, 76, 60, 0.3).ink(1.2); P.blob([26, 40, 36, 26, 54, 30, 70, 24, 76, 40, 70, 58, 52, 54, 34, 60]).hatch(1.8, 0.4, 0.2); };
A.bone = (P) => { P.table(62, '#4a3a2a'); for (const [x, y, r] of [[48, 50, -0.5], [54, 54, 0.4]]) P.at(x, y, 1, r, () => { P.rect(-14, -2.4, 28, 4.8, 2).fill('#efe6d0').ink(1); for (const ex of [-14, 14]) { P.circle(ex, -2.4, 3).fill('#efe6d0').ink(1); P.circle(ex, 2.4, 3).fill('#efe6d0').ink(1); } }); };
A.feather = (P) => { P.at(50, 40, 1, -0.5, () => { P.path((c) => { c.moveTo(0, 26); c.quadraticCurveTo(-12, 0, 0, -28); c.quadraticCurveTo(12, 0, 0, 26); }).lfill('#e8e0d0', -12, -28, 12, 26, 0.3).ink(1); P.line(0, 26, 0, -26, 0.9, '#8a7a6a'); for (let i = 0; i < 7; i++) P.line(0, -18 + i * 6, -8 + Math.abs(i - 3), -22 + i * 6, 0.4, 'rgba(80,60,40,0.5)'); }); };
A.charcoal = (P) => { pile(P, 50, 64, 1.1, '#2a2622', { dotColor: '#5a5048', dots: 30, dot: 1.4 }); P.halo(44, 52, 6, 'rgba(255,90,30,1)', 0.7); };
A.clay = (P) => { P.table(62, '#4a3a2a'); P.blob([28, 58, 32, 40, 50, 34, 68, 40, 72, 58]).lfill('#b8774a', 28, 34, 72, 58, 0.3).ink(1.2); P.curve(36, 46, 46, 42, 58, 46, 1, 'rgba(255,230,200,0.4)'); };
A.reed = (P) => { P.at(50, 48, 1, 0.25, () => { for (let i = 0; i < 9; i++) P.line(-26, -6 + i * 1.6, 26, -10 + i * 1.6, 1.3, i % 2 ? '#c8b46a' : '#a8964a'); P.rect(-4, -12, 6, 16, 1).fill('#6a4a2a').ink(0.7); }); };
A.sand = (P) => { pile(P, 50, 64, 1.2, '#e0c890', { dotColor: '#b89a5a', dots: 40, dot: 0.6 }); };
A.rope = (P) => { for (let i = 0; i < 4; i++) P.ellipse(50, 50 - i * 2, 22 - i * 3, 10 - i * 1.5).ink(4.4, INK).ellipse(50, 50 - i * 2, 22 - i * 3, 10 - i * 1.5).ink(3, '#b89a5a'); P.curve(70, 50, 78, 56, 76, 66, 3, '#b89a5a'); };
A.plank = (P) => { planks(P, 50, 60, 1.25); };
A.brick = (P) => { bricks(P, 50, 64, 1.3); };
A.cloth = (P) => { P.at(50, 50, 1, -0.15, () => { P.rect(-24, -10, 48, 20, 3).lfill('#b8483a', -24, -10, 24, 10, 0.3).ink(1.2); for (let i = 0; i < 6; i++) P.line(-22 + i * 9, -10, -22 + i * 9, 10, 0.5, 'rgba(255,220,180,0.35)'); P.ellipse(24, 0, 4, 10).fill('#8a2a22').ink(1); }); };
A.leather = (P) => { P.at(50, 50, 1, 0.1, () => { P.rect(-24, -12, 48, 22, 4).lfill('#8a5a32', -24, -12, 24, 10, 0.3).ink(1.2); P.rect(-24, -2, 48, 3).fill('#6a4224'); P.path((c) => { for (let i = 0; i < 9; i++) { c.moveTo(-22 + i * 5.4, -10); c.lineTo(-20 + i * 5.4, -10); } }).ink(0.8, '#e8d8b0'); }); };
A.herb = (P) => { herbs(P, 50, 66, 1.5, '#5a9a4a'); };
A.salt = (P) => { pile(P, 50, 64, 1.2, '#f2efe6', { dotColor: '#c8c4b8', dots: 26, dot: 1 }); for (let i = 0; i < 5; i++) crystal(P, 34 + i * 8, 64 - (i % 2) * 4, 0.25, '#fbfbfb'); };
A.copper_ore = (P) => { ore(P, 50, 62, 1.4, '#6a5a4a', '#3fa58a'); };
A.tin_ore = (P) => { ore(P, 50, 62, 1.4, '#5a5a5a', '#c8ccd2'); };
A.iron_ore = (P) => { ore(P, 50, 62, 1.4, '#6a4a3a', '#9a3a2a'); };
A.coal = (P) => { pile(P, 50, 64, 1.1, '#262422', { dotColor: '#4a4844', dots: 30, dot: 1.6 }); };
A.copper = (P) => { ingot(P, 50, 62, 1.25, '#c9773a'); };
A.bronze = (P) => { ingot(P, 50, 62, 1.25, '#b8903a'); };
A.iron = (P) => { ingot(P, 50, 62, 1.25, '#7a8088'); };
A.glass = (P) => { P.at(50, 42, 1, 0.1, () => { P.rect(-20, -20, 40, 40, 2).fill('rgba(190,230,240,0.55)').ink(1.2); P.line(-14, -12, -4, -18, 1.4, 'rgba(255,255,255,0.8)'); P.line(-10, -4, 4, -14, 1, 'rgba(255,255,255,0.6)'); }); };
A.flour = (P) => { sack(P, 50, 66, 1.45, '#e8e0cc', '#c9a45a'); P.circle(50, 50, 5).fill('#e8d8a8'); };
A.paper = (P) => { for (let i = 0; i < 3; i++) P.at(50 + i * 2, 46 - i * 3, 1, (i - 1) * 0.08, () => { P.rect(-20, -14, 40, 28, 1).fill(i === 2 ? '#f2e8cc' : '#e2d6b4').ink(0.9); }); for (let i = 0; i < 3; i++) P.line(38, 36 + i * 5, 62, 36 + i * 5, 0.5, 'rgba(60,40,20,0.35)'); };
A.oil = (P) => { jar(P, 50, 66, 1.4, '#5a6a3a', '#c8b04a'); P.halo(50, 40, 10, 'rgba(255,220,120,1)', 0.35); };
A.gear = (P) => { gearShape(P, 44, 42, 1.3, '#9a8a6a'); gearShape(P, 66, 56, 0.8, '#b8a070', 7); };
A.steam_core = (P) => { P.halo(50, 40, 30, 'rgba(120,200,255,1)', 0.35); P.circle(50, 40, 18).lfill('#8a7a5a', 32, 22, 68, 58, 0.4).ink(1.3); P.circle(50, 40, 9).rfill('#d8f4ff', '#3a8aba', 50, 40, 9); for (const a of [0, 1.6, 3.2, 4.8]) P.line(50 + Math.cos(a) * 18, 40 + Math.sin(a) * 18, 50 + Math.cos(a) * 26, 40 + Math.sin(a) * 26, 3, '#7a6a4a'); };
A.sulfur = (P) => { for (const [x, y] of [[40, 60], [58, 62], [50, 50]]) crystal(P, x, y, 0.8, '#e8d24a'); P.curve(30, 30, 40, 22, 34, 12, 2, 'rgba(240,230,150,0.3)'); };
A.gunpowder = (P) => { P.at(50, 62, 1, 0, () => { P.shadow(0, 2, 20, 4); P.path((c) => { c.moveTo(-14, 0); c.quadraticCurveTo(-18, -16, -14, -32); c.lineTo(14, -32); c.quadraticCurveTo(18, -16, 14, 0); c.closePath(); }).lfill('#6a4428', -18, -32, 18, 0).ink(1.2); for (const by of [-6, -26]) P.rect(-16, by - 2, 32, 4).fill('#3a3a3a'); P.rect(-6, -22, 12, 8, 1).fill('#e8dcc0').ink(0.6); P.circle(0, -18, 2).fill('#2a2a2a'); }); };
A.crystal = (P) => { crystal(P, 50, 66, 1.5, '#9ae0f0', 'rgba(140,230,255,1)'); };
A.ember_shard = (P) => { P.halo(50, 44, 34, 'rgba(255,150,50,1)', 0.5); crystal(P, 50, 64, 1.4, '#ff9a3a', 'rgba(255,160,60,1)'); };
A.shadow_dust = (P) => { bottle(P, 50, 66, 1.4, '#4a3a6a', { glow: 'rgba(150,100,220,1)' }); for (let i = 0; i < 10; i++) P.circle(30 + P.r() * 40, 20 + P.r() * 20, 0.8).fill('rgba(170,130,230,0.7)'); };
A.star_metal = (P) => { P.halo(50, 46, 30, 'rgba(160,200,255,1)', 0.35); P.blob([30, 56, 32, 38, 50, 30, 70, 36, 72, 54, 52, 62]).lfill('#4a5268', 30, 30, 72, 62, 0.4).ink(1.2); for (let i = 0; i < 8; i++) P.circle(36 + P.r() * 30, 38 + P.r() * 18, 0.9).fill('#cfe0ff'); };
A.pearl = (P) => { P.at(50, 52, 1, 0, () => { P.path((c) => { c.moveTo(-24, 6); c.quadraticCurveTo(0, -30, 24, 6); c.quadraticCurveTo(0, 16, -24, 6); }).lfill('#c8a8b8', -24, -24, 24, 16).ink(1.1); P.halo(0, -2, 16, 'rgba(255,240,250,1)', 0.6); P.circle(0, -2, 7).rfill('#ffffff', '#d8c8d8', 0, -2, 7).ink(0.8); }); };
A.ivory = (P) => { P.path((c) => { c.moveTo(24, 64); c.quadraticCurveTo(30, 20, 76, 16); c.quadraticCurveTo(40, 30, 34, 66); c.closePath(); }).lfill('#efe6cc', 24, 16, 76, 66, 0.3).ink(1.2); };
A.fur = (P) => { P.blob([24, 44, 34, 26, 54, 30, 72, 24, 78, 44, 70, 60, 50, 56, 32, 62]).lfill('#7a6a5a', 24, 24, 78, 62, 0.3).ink(1.2); for (let i = 0; i < 20; i++) { const x = 30 + P.r() * 42, y = 30 + P.r() * 26; P.line(x, y, x + 2, y + 3, 0.7, 'rgba(240,230,210,0.5)'); } };
A.ice = (P) => { P.at(50, 46, 1, 0.08, () => { P.rect(-18, -16, 36, 32, 3).fill('rgba(200,235,250,0.85)').ink(1.2); P.poly([-18, -16, -10, -22, 26, -22, 18, -16]).fill('rgba(230,248,255,0.9)').ink(1); P.line(-12, -10, -2, -14, 1.4, 'rgba(255,255,255,0.9)'); }); };
A.obsidian = (P) => { P.halo(50, 46, 20, 'rgba(160,80,200,1)', 0.2); for (const [x, y, r] of [[42, 54, -0.3], [60, 52, 0.4]]) P.at(x, y, 1, r, () => P.poly([-12, 6, -6, -14, 8, -12, 12, 4, 0, 10]).lfill('#2a1e30', -12, -14, 12, 10, 0.5).ink(1.1)); };
A.driftwood = (P) => { BG.shore(P); P.at(50, 52, 1, -0.15, () => { P.path((c) => { c.moveTo(-30, 2); c.quadraticCurveTo(-10, -8, 30, -2); c.lineTo(28, 6); c.quadraticCurveTo(-10, 4, -30, 8); c.closePath(); }).lfill('#b8a488', -30, -8, 30, 8).ink(1.2); P.curve(10, -4, 18, -14, 24, -12, 1.6, '#9a8668'); }); };
A.seaweed = (P) => { for (let i = 0; i < 5; i++) P.path((c) => { const x = 30 + i * 10; c.moveTo(x, 70); c.quadraticCurveTo(x - 8, 50, x + 2, 38); c.quadraticCurveTo(x + 8, 26, x, 16); }).ink(3.4, i % 2 ? '#3a6a3a' : '#4a7a3a'); };
A.wax = (P) => { P.at(50, 46, 1, 0, () => { for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++) { const x = -15 + k * 10 + (r % 2) * 5, y = -10 + r * 8.6; P.poly([x - 5, y, x - 2.5, y - 4.3, x + 2.5, y - 4.3, x + 5, y, x + 2.5, y + 4.3, x - 2.5, y + 4.3]).lfill('#e8c45a', x - 5, y - 5, x + 5, y + 5).ink(0.8); } }); };
A.candle = (P) => { P.table(64, '#4a3a2a'); for (const x of [40, 58]) { P.rect(x - 5, 34, 10, 30, 2).lfill('#efe3c0', x - 5, 34, x + 5, 64).ink(1); flame(P, x, 34, 0.7); } };
A.heartwood = (P) => { P.halo(50, 44, 34, 'rgba(160,255,120,1)', 0.35); logs(P, 50, 58, 1.1, 1, '#7a5a3a'); P.ellipse(62, 58, 4, 5.5).fill('#c8ff9a'); };
A.wolf_pelt = (P) => { P.blob([20, 46, 32, 24, 56, 28, 76, 20, 82, 44, 70, 62, 50, 56, 30, 64]).lfill('#9aa0a8', 20, 20, 82, 64, 0.3).ink(1.3); P.poly([70, 22, 76, 12, 80, 24]).fill('#8a9098').ink(0.9); for (let i = 0; i < 24; i++) { const x = 28 + P.r() * 48, y = 28 + P.r() * 30; P.line(x, y, x + 2, y + 3, 0.7, 'rgba(255,255,255,0.4)'); } };
A.croc_tooth = (P) => { P.halo(50, 44, 26, 'rgba(255,240,200,1)', 0.25); P.path((c) => { c.moveTo(38, 22); c.quadraticCurveTo(62, 26, 60, 34); c.quadraticCurveTo(56, 56, 46, 68); c.quadraticCurveTo(44, 46, 38, 22); }).lfill('#efe6cc', 38, 22, 62, 68, 0.35).ink(1.2); };
A.molten_core = (P) => { P.halo(50, 42, 38, 'rgba(255,110,30,1)', 0.6); P.circle(50, 42, 16).rfill('#fff2a0', '#c8380e', 50, 42, 16).ink(1.2); P.path((c) => { c.moveTo(40, 34); c.lineTo(48, 42); c.lineTo(44, 50); c.moveTo(56, 32); c.lineTo(52, 44); }).ink(1.4, '#7a1a08'); };
A.frost_heart = (P) => { P.halo(50, 40, 36, 'rgba(160,220,255,1)', 0.6); crystal(P, 50, 60, 1.3, '#d8f4ff', 'rgba(170,230,255,1)'); };
A.abyss_pearl = (P) => { P.halo(50, 42, 38, 'rgba(120,160,255,1)', 0.6); P.circle(50, 42, 17).rfill('#f0f4ff', '#3a4a9a', 50, 42, 17).ink(1.2); P.ellipse(44, 36, 5, 3, -0.5).fill('rgba(255,255,255,0.8)'); };

// tools ------------------------------------------------------------------------------------------
A.stone_axe = (P) => { P.at(48, 62, 1.6, 0, () => { P.at(0, 0, 1, -0.4, () => { P.rect(-1.6, -30, 3.2, 34, 1.5).fill('#8a5a32').ink(1); P.poly([1, -30, 12, -28, 13, -18, 1, -20]).lfill('#7a7670', 1, -30, 13, -18).ink(1); P.line(-2, -24, 2, -22, 1.4, '#c9b080'); }); }); };
A.stone_pick = (P) => { P.at(50, 64, 1.6, 0, () => { P.at(0, 0, 1, -0.3, () => { P.rect(-1.6, -30, 3.2, 34, 1.5).fill('#8a5a32').ink(1); P.path((c) => { c.moveTo(-14, -24); c.quadraticCurveTo(0, -34, 14, -24); c.quadraticCurveTo(0, -29, -14, -24); }).fill('#7a7670').ink(1); }); }); };
A.bronze_axe = (P) => { A.stone_axe(P); P.halo(62, 26, 10, 'rgba(255,200,120,1)', 0.4); P.at(48, 62, 1.6, 0, () => P.at(0, 0, 1, -0.4, () => P.poly([1, -30, 12, -28, 13, -18, 1, -20]).lfill('#c8903a', 1, -30, 13, -18).ink(1))); };
A.bronze_pick = (P) => { A.stone_pick(P); P.at(50, 64, 1.6, 0, () => P.at(0, 0, 1, -0.3, () => P.path((c) => { c.moveTo(-14, -24); c.quadraticCurveTo(0, -34, 14, -24); c.quadraticCurveTo(0, -29, -14, -24); }).fill('#c8903a').ink(1))); };
A.iron_axe = (P) => { A.stone_axe(P); P.at(48, 62, 1.6, 0, () => P.at(0, 0, 1, -0.4, () => P.poly([1, -30, 12, -28, 13, -18, 1, -20]).lfill('#a8b0b8', 1, -30, 13, -18, 0.5).ink(1))); };
A.iron_pick = (P) => { A.stone_pick(P); P.at(50, 64, 1.6, 0, () => P.at(0, 0, 1, -0.3, () => P.path((c) => { c.moveTo(-14, -24); c.quadraticCurveTo(0, -34, 14, -24); c.quadraticCurveTo(0, -29, -14, -24); }).fill('#a8b0b8').ink(1))); };
A.fishing_rod = (P) => { P.water(56); P.line(24, 70, 66, 14, 2, '#8a5a32'); P.curve(66, 14, 80, 26, 76, 58, 0.7, '#f0e8d8'); P.circle(76, 58, 2).fill('#c33').ink(0.6); };
A.net = (P) => { P.at(50, 40, 1, 0, () => { for (let i = -3; i <= 3; i++) { P.curve(-26, i * 7, 0, i * 7 + 6, 26, i * 7, 0.8, '#c8b47a'); P.curve(i * 7, -24, i * 7 + 5, 0, i * 7, 24, 0.8, '#c8b47a'); } for (const [x, y] of [[-20, -20], [20, -20], [-20, 20], [20, 20]]) P.circle(x, y, 2.6).fill('#e8dcc0').ink(0.8); }); };
A.hoe = (P) => { P.shadow(50, 66, 26, 4); P.at(50, 40, 1, -0.6, () => { P.rect(-1.8, -30, 3.6, 62, 1.5).lfill('#8a5a32', -2, -30, 2, 32).ink(1); P.poly([-1.8, -30, -16, -26, -18, -18, -1.8, -22]).lfill('#8f99a3', -18, -30, 0, -18, 0.4).ink(1.1); P.rect(-3, -32, 6, 10, 1).fill('#5a3a20').ink(0.9); }); };
A.pot = (P) => { jar(P, 50, 66, 1.5, '#b5793a', '#6a3a1a', { band: '#7a4a24' }); };
A.torch = (P) => { P.halo(50, 26, 36, 'rgba(255,170,70,1)', 0.45); P.at(50, 70, 1.6, 0.1, () => { P.rect(-2, -26, 4, 28, 1.5).lfill('#6a4222', -2, -26, 2, 2).ink(1); P.rect(-3.4, -28, 6.8, 6, 1).fill('#8a6a3a').ink(0.9); flame(P, 0, -28, 0.95); }); };
A.lantern = (P) => { P.halo(50, 38, 40, 'rgba(255,200,110,1)', 0.55); P.at(50, 64, 1.7, 0, () => { P.path((c) => { c.arc(0, -30, 6, Math.PI, 0); }).ink(1.4); P.rect(-8, -24, 16, 20, 2).fill('rgba(255,224,150,0.95)').ink(1.3); P.rect(-10, -26, 20, 3, 1).fill('#4a3a2a').ink(0.9); P.rect(-10, -4, 20, 4, 1).fill('#4a3a2a').ink(0.9); P.line(-4, -24, -4, -4, 0.8); P.line(4, -24, 4, -4, 0.8); flame(P, 0, -8, 0.5); }); };
A.spear = (P) => { P.at(50, 70, 1.4, 0.55, () => { P.rect(-1.4, -50, 2.8, 52, 1).fill('#8a5a32').ink(1); P.poly([0, -60, 4, -48, 0, -45, -4, -48]).lfill('#9a948a', -4, -60, 4, -45).ink(1); P.line(-2, -46, 2, -44, 1.4, '#c9b080'); }); };
A.bow = (P) => { P.at(50, 40, 1.5, 0.3, () => { P.path((c) => { c.moveTo(0, -24); c.quadraticCurveTo(16, 0, 0, 24); }).ink(3.2, '#7a4a22').path((c) => { c.moveTo(0, -24); c.quadraticCurveTo(16, 0, 0, 24); }).ink(1); P.line(0, -24, 0, 24, 0.7, '#e8dcc0'); P.line(-10, 0, 14, 0, 1.1, '#8a6a42'); P.poly([14, 0, 10, -2, 10, 2]).fill('#9aa0a8'); }); };
A.mace = (P) => { P.shadow(50, 68, 24, 4); P.at(52, 40, 1, 0.5, () => { P.rect(-2, -10, 4, 40, 1.5).lfill('#6a4a2a', -2, -10, 2, 30).ink(1); P.rect(-3, 22, 6, 8, 1).fill('#3a2416').ink(0.9); for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; P.poly([Math.cos(a - 0.25) * 9, -18 + Math.sin(a - 0.25) * 9, Math.cos(a) * 15, -18 + Math.sin(a) * 15, Math.cos(a + 0.25) * 9, -18 + Math.sin(a + 0.25) * 9]).fill('#7a828a').ink(0.8); } P.circle(0, -18, 10).lfill('#9aa2aa', -10, -28, 10, -8, 0.45).ink(1.2); P.circle(-3, -21, 2.4).fill('rgba(255,255,255,0.5)'); }); };
A.musket = (P) => { P.at(50, 44, 1.4, -0.5, () => { P.rect(-30, -2, 44, 4, 1).fill('#4a4f55').ink(1); P.rect(10, -4, 22, 8, 3).lfill('#6a4222', 10, -4, 32, 4).ink(1); P.line(6, 2, 8, 8, 1.4); }); };
A.toolbox = (P) => { P.at(50, 64, 1, 0, () => { P.shadow(0, 1, 26, 5); P.rect(-24, -20, 48, 20, 2).lfill('#8a5a32', -24, -20, 24, 0).ink(1.2); P.path((c) => { c.moveTo(-8, -20); c.lineTo(-8, -28); c.lineTo(8, -28); c.lineTo(8, -20); }).ink(2, '#5a3a20'); P.at(-12, -22, 0.6, -0.4, () => item(P, 'wrench', 'hold')); P.line(4, -20, 16, -30, 2.4, '#9aa0a8'); }); };
A.book = (P) => { book(P, 50, 58, 1.5, '#7a2e2a'); };
A.herb_kit = (P) => { sack(P, 50, 66, 1.3, '#8a7a4a'); herbs(P, 50, 34, 0.7); };
A.map = (P) => { P.at(50, 40, 1, -0.06, () => { P.rect(-30, -20, 60, 40, 1).fill('#e2d2a6').ink(1.1); P.curve(-24, 10, -6, -10, 20, 6, 1, '#7a6a4a'); P.curve(-20, -12, 0, -4, 18, -14, 0.8, '#5a8aa8'); P.path((c) => { c.moveTo(14, 2); c.lineTo(18, 6); c.moveTo(18, 2); c.lineTo(14, 6); }).ink(1.4, '#a33'); for (const [x, y] of [[-14, -2], [-6, -6]]) P.poly([x - 4, y + 3, x, y - 3, x + 4, y + 3]).fill('#8a7a5a'); }); };
A.scale = (P) => { P.shadow(50, 68, 26, 4); P.rect(36, 62, 28, 6, 2).lfill('#7a5232', 36, 62, 64, 68).ink(1); P.rect(48.5, 20, 3, 44, 1).lfill('#c9a45a', 48, 20, 52, 64).ink(1); P.at(50, 22, 1, -0.12, () => { P.rect(-30, -1.6, 60, 3.2, 1.5).lfill('#c9a45a', -30, -2, 30, 2).ink(1); for (const sx of [-27, 27]) { P.line(sx, 0, sx - 9, 22, 0.7); P.line(sx, 0, sx + 9, 22, 0.7); P.path((c) => { c.moveTo(sx - 11, 22); c.quadraticCurveTo(sx, 30, sx + 11, 22); c.closePath(); }).lfill('#d9b46a', sx - 11, 22, sx + 11, 28).ink(1); } }); P.circle(50, 19, 3).fill('#e8c46a').ink(0.9); coin(P, 26, 44, 0.55); coin(P, 29, 42, 0.55); };
A.compass = (P) => { P.shadow(50, 64, 28, 5); P.at(50, 38, 1, 0, () => { P.circle(0, 0, 25).lfill('#c9a45a', -25, -25, 25, 25, 0.45).ink(1.4); P.circle(0, 0, 20).rfill('#f6eed6', '#d8c8a0', 0, 0, 20).ink(1); for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, r0 = i % 4 ? 17 : 14; P.line(Math.cos(a) * r0, Math.sin(a) * r0, Math.cos(a) * 19, Math.sin(a) * 19, i % 4 ? 0.5 : 1); } for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2; P.poly([0, 0, Math.cos(a - 0.3) * 5, Math.sin(a - 0.3) * 5, Math.cos(a) * 15, Math.sin(a) * 15, Math.cos(a + 0.3) * 5, Math.sin(a + 0.3) * 5]).fill(i % 2 ? '#8a7a5a' : '#5a4a32').ink(0.5); } P.at(0, 0, 1, 0.5, () => { P.poly([0, -17, 3, 0, -3, 0]).fill('#b8322a').ink(0.7); P.poly([0, 17, 3, 0, -3, 0]).fill('#e8e0d0').ink(0.7); }); P.circle(0, 0, 2.2).fill('#c9a45a').ink(0.7); P.rect(-4, -31, 8, 6, 2).fill('#b8903a').ink(1); P.path((c) => c.arc(0, -10, 18, -2.4, -1.4)).ink(1.4, 'rgba(255,255,255,0.45)'); }); };
A.telescope = (P) => { P.at(50, 50, 1.3, -0.5, () => { P.rect(-24, -4, 20, 8, 2).lfill('#b8903a', -24, -4, -4, 4).ink(1); P.rect(-6, -5, 20, 10, 2).lfill('#8a6a2a', -6, -5, 14, 5).ink(1); P.rect(12, -6, 12, 12, 2).lfill('#c8a04a', 12, -6, 24, 6).ink(1); P.ellipse(24, 0, 2, 5).fill('rgba(180,220,240,0.9)').ink(0.8); }); P.stars(8, 30); };
A.star_chart = (P) => { BG.deep(P); P.at(50, 40, 1, 0, () => { P.circle(0, 0, 26).ink(0.8, 'rgba(220,230,255,0.5)'); P.circle(0, 0, 16).ink(0.6, 'rgba(220,230,255,0.4)'); for (let i = 0; i < 8; i++) { const a = i * 0.785; P.line(0, 0, Math.cos(a) * 26, Math.sin(a) * 26, 0.4, 'rgba(220,230,255,0.3)'); } const pts = [[-12, -8], [-4, -14], [6, -6], [14, -12], [4, 8], [-8, 10]]; for (let i = 0; i < pts.length - 1; i++) P.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 0.8, 'rgba(255,230,150,0.7)'); for (const [x, y] of pts) P.circle(x, y, 1.6).fill('#ffe8a0'); }); };
A.boat = (P) => { P.sky('#9ab8c8', '#efe0c0', 52); P.water(52); boat(P, 50, 60, 1.05); };
A.raft = (P) => { P.water(48); P.at(50, 56, 1, 0, () => { for (let i = 0; i < 6; i++) P.rect(-26 + i * 9, -6, 8, 12, 3).lfill('#a8946e', -26 + i * 9, -6, -18 + i * 9, 6).ink(1); P.line(-26, -2, 28, -2, 1.4, '#c8b47a'); P.line(-26, 3, 28, 3, 1.4, '#c8b47a'); }); };
A.quill = (P) => { A.feather(P); P.at(50, 40, 1, -0.5, () => P.poly([0, 26, -1.6, 32, 0, 36, 1.6, 32]).fill('#2a2a2a')); P.circle(30, 66, 6).fill('#1a1a2a').ink(1); };
A.holy_flame = (P) => { P.rays(50, 40, 16, 60, 'rgba(255,240,180,0.2)', 6); P.halo(50, 40, 40, 'rgba(255,200,90,1)', 0.7); P.at(50, 62, 1, 0, () => { P.path((c) => { c.moveTo(-14, 0); c.quadraticCurveTo(-12, -6, -6, -8); c.lineTo(6, -8); c.quadraticCurveTo(12, -6, 14, 0); c.closePath(); }).lfill('#c9a45a', -14, -8, 14, 0).ink(1.1); flame(P, 0, -8, 1.9, true); }); };
A.saddle_horse = (P) => { BG.meadow(P); quadruped(P, 52, 70, 1.05, { body: '#7a4a2a', len: 34, h: 15, legs: 16, head: 6, neck: 8, headUp: 12, tail: 6, mane: true, ears: true }); P.rect(46, 40, 14, 6, 2).fill('#5a2a1a').ink(0.9); };
A.domestic_goat = (P) => { BG.meadow(P); quadruped(P, 52, 70, 1, { body: '#e8e0d0', len: 28, h: 13, legs: 11, head: 5.5, tail: 2, horns: 'curl', ears: true }); P.rect(36, 50, 6, 4, 1).fill('#c33'); };
A.hen = (P) => { BG.meadow(P); bird(P, 52, 70, 1.6, { body: '#c8783a', crest: '#c33' }); };
A.potion = (P) => { bottle(P, 50, 66, 1.6, '#c3343a', { glow: 'rgba(255,90,90,1)' }); };
A.elixir = (P) => { P.rays(50, 36, 12, 50, 'rgba(255,240,190,0.15)'); bottle(P, 50, 66, 1.6, '#e8b83a', { glow: 'rgba(255,220,100,1)' }); };
A.bandage = (P) => { for (let i = 0; i < 3; i++) P.ellipse(50, 50, 20 - i * 6, 14 - i * 4).fill(i % 2 ? '#e8e0d0' : '#f4efe4').ink(0.9); P.path((c) => { c.moveTo(66, 52); c.lineTo(84, 64); c.lineTo(80, 70); c.lineTo(62, 58); c.closePath(); }).fill('#f4efe4').ink(0.9); };

// gear -------------------------------------------------------------------------------------------
const sword = (P, blade, hilt = '#b98f3a', o = {}) => P.at(50, 66, 1.65, 0.6, () => {
  if (o.glow) P.halo(0, -16, 22, o.glow, 0.5);
  P.poly([-2, -36, 0, -40, 2, -36, 1.8, -4, -1.8, -4]).lfill(blade, -2, -40, 2, -4, 0.5).ink(1);
  P.line(0, -36, 0, -6, 0.5, 'rgba(255,255,255,0.6)');
  P.rect(-7, -5, 14, 2.6, 1).fill(hilt).ink(0.8);
  P.rect(-1.4, -2.4, 2.8, 8, 1).fill('#4a2a1a').ink(0.7);
  P.circle(0, 6, 2).fill(hilt).ink(0.6);
});
A.club = (P) => { P.at(50, 68, 1.4, 0.5, () => P.path((c) => { c.moveTo(-2, 4); c.lineTo(-2.4, -20); c.quadraticCurveTo(-7, -34, 0, -40); c.quadraticCurveTo(7, -34, 2.6, -20); c.lineTo(2, 4); c.closePath(); }).lfill('#8a5a32', -7, -40, 7, 4).ink(1.2)); };
A.bronze_sword = (P) => sword(P, '#c8903a');
A.iron_sword = (P) => sword(P, '#b8c2ca');
A.obsidian_blade = (P) => sword(P, '#3a2a44', '#8a6a9a', { glow: 'rgba(170,110,220,1)' });
A.flame_blade = (P) => { sword(P, '#ff9a3a', '#c9a45a', { glow: 'rgba(255,140,40,1)' }); };
A.star_blade = (P) => { P.stars(16, 76); sword(P, '#cfe0ff', '#e8d070', { glow: 'rgba(170,210,255,1)' }); };
A.heartwood_bow = (P) => { P.halo(50, 40, 30, 'rgba(170,255,120,1)', 0.35); A.bow(P); };
A.fang_spear = (P) => { P.at(50, 70, 1.4, 0.55, () => { P.rect(-1.4, -50, 2.8, 52, 1).fill('#6a4a2a').ink(1); P.path((c) => { c.moveTo(-3, -46); c.quadraticCurveTo(0, -64, 5, -60); c.quadraticCurveTo(3, -52, 3, -46); c.closePath(); }).fill('#efe6cc').ink(1); }); };
const armor = (P, c, o = {}) => P.at(50, 70, 1, 0, () => {
  if (o.glow) P.halo(0, -30, 30, o.glow, 0.45);
  P.shadow(0, 0, 22, 4);
  P.path((cx) => { cx.moveTo(-16, -50); cx.quadraticCurveTo(-24, -48, -26, -40); cx.lineTo(-20, -32); cx.lineTo(-16, -36); cx.lineTo(-14, -6); cx.quadraticCurveTo(0, -2, 14, -6); cx.lineTo(16, -36); cx.lineTo(20, -32); cx.lineTo(26, -40); cx.quadraticCurveTo(24, -48, 16, -50); cx.quadraticCurveTo(0, -42, -16, -50); cx.closePath(); })
    .lfill(c, -26, -50, 26, -2, 0.4).ink(1.3);
  if (o.plates) for (let i = 0; i < 3; i++) P.curve(-13, -30 + i * 8, 0, -26 + i * 8, 13, -30 + i * 8, 0.8, 'rgba(20,10,5,0.5)');
  if (o.fur) P.path((cx) => { cx.moveTo(-18, -48); cx.quadraticCurveTo(0, -38, 18, -48); }).ink(5, o.fur);
  P.line(-10, -44, 0, -40, 0.8, 'rgba(255,255,255,0.4)');
});
A.leather_armor = (P) => armor(P, '#8a5a32', { plates: true });
A.bronze_armor = (P) => armor(P, '#b8903a', { plates: true });
A.iron_armor = (P) => armor(P, '#8a96a2', { plates: true });
A.fur_cloak = (P) => armor(P, '#7a6a5a', { fur: '#d8ccb8' });
A.wolf_cloak = (P) => armor(P, '#9aa0a8', { fur: '#e8e8e8', glow: 'rgba(200,220,255,1)' });
A.molten_plate = (P) => armor(P, '#5a3a30', { plates: true, glow: 'rgba(255,110,30,1)' });
A.shield = (P) => { P.shadow(50, 68, 24, 4); P.at(50, 38, 2.6, 0, () => P.at(16, 20, 1, 0, () => item(P, 'shield', 'hold'))); };
A.bone_charm = (P) => { P.curve(30, 20, 50, 46, 70, 20, 1, '#8a6a42'); for (let i = 0; i < 3; i++) P.at(40 + i * 10, 46 + (i === 1 ? 6 : 0), 0.5, (i - 1) * 0.4, () => A.bone_one(P)); };
A.bone_one = (P) => { P.rect(-10, -2.4, 20, 4.8, 2).fill('#efe6d0').ink(1.4); for (const ex of [-10, 10]) { P.circle(ex, -2.4, 3).fill('#efe6d0').ink(1.4); P.circle(ex, 2.4, 3).fill('#efe6d0').ink(1.4); } };
A.dawn_amulet = (P) => { P.rays(50, 46, 12, 40, 'rgba(255,230,150,0.25)'); P.curve(30, 16, 50, 36, 70, 16, 1, '#c9a45a'); P.halo(50, 48, 18, 'rgba(255,190,80,1)', 0.7); P.circle(50, 48, 10).lfill('#d9a83a', 40, 38, 60, 58).ink(1.1); crystal(P, 50, 54, 0.4, '#ff9a3a'); };
A.frost_amulet = (P) => { P.curve(30, 16, 50, 36, 70, 16, 1, '#a8c8e0'); P.halo(50, 48, 20, 'rgba(170,230,255,1)', 0.7); crystal(P, 50, 60, 0.7, '#d8f4ff'); };
A.pearl_necklace = (P) => { for (let i = 0; i < 11; i++) { const a = Math.PI * 0.12 + (i / 10) * Math.PI * 0.76; P.circle(50 + Math.cos(a) * 26, 18 + Math.sin(a) * 30, 3.2).rfill('#ffffff', '#d0c0d0', 50 + Math.cos(a) * 26, 18 + Math.sin(a) * 30, 3.2).ink(0.6); } P.halo(50, 52, 10, 'rgba(255,240,250,1)', 0.6); P.circle(50, 52, 5).rfill('#ffffff', '#c8b8d8', 50, 52, 5).ink(0.8); };

// knowledge, coins, bundles ------------------------------------------------------------------------
A.insight = (P) => { P.rays(50, 38, 12, 46, 'rgba(255,240,190,0.2)', 5); P.halo(50, 38, 30, 'rgba(255,220,130,1)', 0.7); P.at(50, 38, 1, 0, () => { P.path((c) => { c.moveTo(-18, 0); c.quadraticCurveTo(0, -16, 18, 0); c.quadraticCurveTo(0, 16, -18, 0); c.closePath(); }).fill('#fff6d8').ink(1.2, '#8a6a2a'); P.circle(0, 0, 6.5).rfill('#ffd36a', '#c8781a', 0, 0, 6.5); P.circle(0, 0, 2.6).fill('#2a1a0a'); P.circle(-1.6, -1.6, 1).fill('#fff'); }); };
A.scroll = (P) => { scroll(P, 50, 44, 1.3, { torn: true, seal: '#a33' }); };
A.tome = (P) => { P.halo(50, 40, 34, 'rgba(160,190,255,1)', 0.3); P.at(50, 46, 1.4, 0, () => { P.rect(-18, -22, 34, 42, 2).lfill('#3a4a7a', -18, -22, 16, 20).ink(1.2); P.rect(-14, -18, 26, 34, 1).ink(0.8, '#c9a45a'); P.circle(-1, -1, 6).ink(1, '#c9a45a'); P.poly([-1, -6, 1, -1, -1, 4, -3, -1]).fill('#e8c45a'); P.rect(16, -20, 4, 38).fill('#efe3c0').ink(0.8); }); };
A.relic = (P) => { P.halo(50, 40, 30, 'rgba(255,220,150,1)', 0.25); P.at(50, 64, 1.2, 0, () => { P.shadow(0, 0, 18, 4); P.path((c) => { c.moveTo(-10, 0); c.lineTo(-8, -10); c.quadraticCurveTo(-16, -22, -6, -34); c.lineTo(6, -34); c.quadraticCurveTo(16, -22, 8, -10); c.lineTo(10, 0); c.closePath(); }).lfill('#5a8a7a', -16, -34, 16, 0, 0.35).ink(1.2); P.path((c) => { c.moveTo(-8, -20); c.lineTo(8, -20); c.moveTo(-6, -26); c.lineTo(6, -26); }).ink(1, '#c9a45a'); P.circle(0, -14, 2.4).fill('#c9a45a'); }); };
A.treasure_map = (P) => { A.map(P); P.path((c) => { c.moveTo(56, 40); c.lineTo(62, 46); c.moveTo(62, 40); c.lineTo(56, 46); }).ink(2.4, '#a33'); P.curve(30, 52, 44, 30, 58, 44, 1, 'rgba(160,40,40,0.6)'); };
A.coin = (P) => { for (const [x, y] of [[40, 54], [58, 56], [48, 46], [62, 44], [36, 40]]) coin(P, x, y, 1.05); };
A.gold = (P) => { ingot(P, 50, 60, 1.4, '#e8b83a', 3); };
A.supply_basic = (P) => { sack(P, 50, 66, 1.5, '#b89a6a'); P.line(40, 26, 60, 26, 2, '#6a4a2a'); };
A.food_crate = (P) => { chest(P, 50, 66, 1.2, { color: '#8a6a3a', band: '#5a3a1a' }); A.apple_small(P); };
A.apple_small = (P) => { for (const [x, y] of [[40, 40], [52, 36], [62, 40]]) P.circle(x, y, 5).lfill('#c2402a', x - 5, y - 5, x + 5, y + 5).ink(0.8); };
A.crafter_bundle = (P) => { A.toolbox(P); };
A.explorer_bundle = (P) => { P.at(50, 66, 1, 0, () => { P.shadow(0, 1, 22, 4); P.path((c) => { c.moveTo(-16, 0); c.lineTo(-18, -34); c.quadraticCurveTo(0, -46, 18, -34); c.lineTo(16, 0); c.closePath(); }).lfill('#6a7a4a', -18, -46, 18, 0).ink(1.2); P.rect(-12, -22, 24, 12, 2).fill('#5a6a3a').ink(1); P.rect(-20, -6, 40, 6, 3).fill('#c9b080').ink(1); }); P.at(70, 40, 1, 0.3, () => item(P, 'torch', 'hold')); };
A.military_crate = (P) => { chest(P, 50, 66, 1.2, { color: '#5a4a3a', band: '#8a929a' }); P.at(50, 44, 0.8, 0.9, () => item(P, 'spear', 'hold')); };
A.treasure_chest = (P) => { chest(P, 50, 66, 1.25, { color: '#7a3a1a', band: '#e8b83a', open: true }); for (const [x, y] of [[42, 38], [56, 36], [50, 32]]) coin(P, x, y, 0.5); };
A.seed_pouch = (P) => { sack(P, 50, 66, 1.3, '#a8905a', '#6a9a3a'); for (let i = 0; i < 6; i++) P.ellipse(30 + i * 8, 70, 2, 1.2).fill('#c8a050'); };

// structures -------------------------------------------------------------------------------------
A.campfire = (P) => { BG.night(P); fireRing(P, 50, 64, 1.25); };
A.hearth = (P) => { BG.night(P); fireRing(P, 50, 64, 1.35, { stones: 12, stoneColor: '#9a8a7a', big: true }); P.rect(28, 66, 44, 4, 1).fill('#7a6a5a').ink(0.9); };
A.torch_post = (P) => { BG.night(P); post(P, 50, 70, 1.05); post(P, 72, 66, 0.7); };
A.lamp_post = (P) => { BG.night(P); post(P, 50, 72, 1.1, { lamp: true, pole: '#3a3a42' }); };
A.watchtower = (P) => { BG.dusk(P); tower(P, 50, 72, 1.05, { fire: true, wall: '#7a6a52', roof: '#5a3a24' }); };
A.lighthouse = (P) => { BG.sea(P); P.rect(30, 62, 40, 14).fill('#6a6a62'); tower(P, 50, 70, 1.05, { light: 'rgba(255,230,150,1)', wall: '#e8e0d0', stripes: '#a33a2a', roof: '#3a3a42' }); };
A.beacon = (P) => { BG.ash(P); tower(P, 50, 72, 1.0, { wall: '#5a4a42', roof: '#3a2a22', light: 'rgba(255,160,60,1)', ray: 'rgba(255,170,90,0.2)' }); };
A.aether_lamp = (P) => { BG.night(P); P.at(50, 72, 1, 0, () => { P.rect(-2, -40, 4, 40).fill('#8a7a5a').ink(1); gearShape(P, 0, -6, 0.4, '#c9a45a'); }); crystal(P, 50, 34, 0.9, '#a8f0ff', 'rgba(140,240,255,1)'); };
A.eternal_lamp = (P) => { BG.night(P); P.rect(36, 56, 28, 16, 2).lfill('#8a847a', 36, 56, 64, 72).ink(1.1); P.halo(50, 40, 34, 'rgba(255,170,70,1)', 0.6); P.path((c) => { c.moveTo(38, 56); c.quadraticCurveTo(38, 26, 50, 22); c.quadraticCurveTo(62, 26, 62, 56); c.closePath(); }).fill('rgba(220,240,255,0.35)').ink(1.1); crystal(P, 50, 54, 0.6, '#ff9a3a', 'rgba(255,150,60,1)'); };
A.moon_lantern = (P) => { BG.night(P); P.moon(78, 16, 6); P.at(50, 60, 1.6, 0, () => { P.halo(0, -12, 18, 'rgba(180,140,255,1)', 0.6); P.rect(-8, -24, 16, 20, 2).fill('rgba(200,180,255,0.85)').ink(1.2); P.rect(-10, -26, 20, 3, 1).fill('#2a2a3a'); P.rect(-10, -4, 20, 4, 1).fill('#2a2a3a'); }); };
A.cairn = (P) => { BG.dusk(P); rocks(P, 50, 70, 0.9, '#8a847a', { set: [[0, -2, 16, 8], [0, -12, 12, 7], [0, -20, 8, 6], [0, -27, 5, 4]] }); };
A.shrine = (P) => { BG.dusk(P); P.at(50, 72, 1, 0, () => { P.shadow(0, 0, 20, 4); P.rect(-14, -28, 28, 28, 1).lfill('#9a8a7a', -14, -28, 14, 0).ink(1.2); P.poly([-18, -28, 0, -42, 18, -28]).lfill('#6a3a2a', -18, -42, 18, -28).ink(1.2); P.path((c) => { c.moveTo(-7, 0); c.lineTo(-7, -14); c.quadraticCurveTo(0, -22, 7, -14); c.lineTo(7, 0); c.closePath(); }).fill('#2a1a10'); flame(P, 0, -4, 0.6); }); };
A.memorial = (P) => { BG.dusk(P); P.at(50, 72, 1, 0, () => { P.shadow(0, 0, 18, 4); P.rect(-16, -8, 32, 8, 1).fill('#7a746a').ink(1); P.path((c) => { c.moveTo(-10, -8); c.lineTo(-8, -46); c.lineTo(8, -46); c.lineTo(10, -8); c.closePath(); }).lfill('#9a948a', -10, -46, 10, -8).ink(1.2); for (let i = 0; i < 6; i++) P.line(-5, -40 + i * 5, 5, -40 + i * 5, 0.6, 'rgba(30,20,10,0.5)'); }); P.halo(50, 30, 20, 'rgba(255,220,150,1)', 0.25); };
A.lean_to = (P) => { BG.dusk(P); hut(P, 50, 72, 1.15, { kind: 'lean' }); };
A.cabin = (P) => { BG.dusk(P); hut(P, 50, 72, 1.15, { wall: '#8a6a42', roof: '#6a3a26', chimney: true }); };
A.stone_house = (P) => { BG.dusk(P); hut(P, 50, 72, 1.15, { kind: 'stone', wall: '#9a948a', roof: '#4a4a52', chimney: true }); };
A.snow_hut = (P) => { BG.snow(P); hut(P, 50, 72, 1.15, { kind: 'snow' }); };
A.stone_tablet = (P) => { BG.dusk(P); P.at(50, 72, 1, 0, () => { P.shadow(0, 0, 18, 4); P.path((c) => { c.moveTo(-14, 0); c.lineTo(-14, -34); c.quadraticCurveTo(0, -44, 14, -34); c.lineTo(14, 0); c.closePath(); }).lfill('#8a847a', -14, -44, 14, 0).ink(1.2); for (let i = 0; i < 5; i++) P.line(-9, -32 + i * 6, 9 - (i % 2) * 4, -32 + i * 6, 1, 'rgba(30,20,10,0.55)'); }); };
A.study = (P) => { BG.interior(P); book(P, 40, 56, 0.9, '#3a4a7a'); book(P, 42, 50, 0.8, '#7a2e2a'); scroll(P, 66, 52, 0.6); P.at(70, 30, 1, 0, () => { P.halo(0, 0, 14, 'rgba(255,200,110,1)', 0.6); flame(P, 0, 4, 0.5); P.rect(-2, 4, 4, 10).fill('#efe3c0'); }); };
A.library = (P) => { P.rect(-2, -2, 104, 80).fill('#3a2618'); for (let r = 0; r < 4; r++) { P.rect(4, 6 + r * 17, 92, 3).fill('#6a4428').ink(0.8); for (let k = 0; k < 14; k++) P.rect(6 + k * 6.4, 6 + r * 17 - 12 + (k % 3), 5, 12 - (k % 3), 0.5).fill(['#7a2e2a', '#3a4a7a', '#5a6a3a', '#8a6a2a'][(k + r) % 4]).ink(0.5); } P.halo(50, 40, 50, 'rgba(255,190,100,1)', 0.15); };
A.observatory = (P) => { BG.night(P); P.moon(20, 16, 5); P.at(50, 72, 1, 0, () => { P.shadow(0, 0, 26, 4); P.rect(-22, -20, 44, 20).lfill('#8a847a', -22, -20, 22, 0).ink(1.2); P.path((c) => { c.arc(0, -20, 22, Math.PI, 0); c.closePath(); }).lfill('#5a6a7a', -22, -42, 22, -20, 0.4).ink(1.2); P.rect(-3, -42, 6, 18).fill('#1a1a2a'); P.at(4, -34, 1, -0.7, () => P.rect(-3, -16, 6, 20, 2).fill('#c9a45a').ink(1)); }); };
A.drying_rack = (P) => { BG.dusk(P); P.at(50, 70, 1, 0, () => { P.line(-22, 0, -18, -34, 2, '#6a4428'); P.line(22, 0, 18, -34, 2, '#6a4428'); P.line(-22, -30, 22, -30, 1.6, '#6a4428'); for (let i = 0; i < 5; i++) P.rect(-16 + i * 8, -30, 4.5, 16, 1.5).lfill('#8a3a24', -16 + i * 8, -30, -11 + i * 8, -14).ink(0.8); }); };
A.workbench = (P) => { BG.interior(P); P.at(50, 70, 1, 0, () => { P.shadow(0, 0, 28, 4); P.rect(-28, -24, 56, 6, 1).lfill('#a8784a', -28, -24, 28, -18).ink(1.2); for (const lx of [-24, 20]) P.rect(lx, -18, 4, 18).fill('#6a4428').ink(1); P.at(-10, -28, 0.6, 0.6, () => item(P, 'axe', 'hold')); P.rect(6, -30, 14, 6, 1).fill('#c08a50').ink(0.9); }); };
A.kiln = (P) => { BG.dusk(P); furnace(P, 50, 72, 1.15, { color: '#9a5a3a' }); };
A.loom = (P) => { BG.interior(P); P.at(50, 70, 1, 0, () => { P.rect(-24, -40, 4, 40).fill('#6a4428').ink(1); P.rect(20, -40, 4, 40).fill('#6a4428').ink(1); P.rect(-24, -42, 48, 4).fill('#7a5232').ink(1); P.rect(-20, -34, 40, 22).fill('#b8483a').ink(1); for (let i = 0; i < 10; i++) P.line(-20 + i * 4, -34, -20 + i * 4, -12, 0.5, 'rgba(255,220,180,0.4)'); P.rect(-24, -12, 48, 3).fill('#7a5232').ink(0.9); }); };
A.tannery = (P) => { BG.dusk(P); P.at(50, 70, 1, 0, () => { P.line(-24, 0, -20, -40, 2, '#6a4428'); P.line(24, 0, 20, -40, 2, '#6a4428'); P.line(-22, -38, 22, -38, 1.6, '#6a4428'); P.blob([-18, -36, -4, -38, 14, -36, 16, -10, 0, -6, -16, -10]).lfill('#a8784a', -18, -38, 16, -6).ink(1.1); }); };
A.smelter = (P) => { BG.dusk(P); furnace(P, 50, 72, 1.2, { color: '#6a5a52' }); P.at(78, 70, 0.6, 0, () => ingot(P, 0, 0, 1, '#c9773a', 1)); };
A.forge = (P) => { BG.interior(P); P.halo(30, 40, 30, 'rgba(255,130,40,1)', 0.4); anvil(P, 52, 70, 1.25); P.at(66, 50, 0.9, 0.5, () => item(P, 'mace', 'hold')); };
A.mill = (P) => { BG.meadow(P); P.at(50, 74, 1, 0, () => { P.shadow(0, 0, 18, 4); P.poly([-12, 0, -8, -40, 8, -40, 12, 0]).lfill('#c8b08a', -12, -40, 12, 0).ink(1.2); P.poly([-10, -40, 0, -48, 10, -40]).fill('#6a3a26').ink(1); P.rect(-3, -10, 6, 10).fill('#3a2414'); P.at(0, -38, 1, 0.4, () => { for (let i = 0; i < 4; i++) P.at(0, 0, 1, (i * Math.PI) / 2, () => { P.line(0, 0, 0, -26, 1.4, '#5a3a20'); P.rect(1, -26, 7, 20).fill('rgba(232,220,190,0.9)').ink(0.9); }); }); }); };
A.bakery = (P) => { BG.interior(P); P.at(50, 70, 1, 0, () => { P.path((c) => { c.moveTo(-24, 0); c.lineTo(-24, -14); c.quadraticCurveTo(0, -40, 24, -14); c.lineTo(24, 0); c.closePath(); }).lfill('#b5553a', -24, -40, 24, 0).ink(1.3); P.halo(0, -8, 14, 'rgba(255,150,50,1)', 0.7); P.path((c) => { c.moveTo(-9, 0); c.lineTo(-9, -8); c.quadraticCurveTo(0, -16, 9, -8); c.lineTo(9, 0); c.closePath(); }).vfill('#ffcf6a', '#b84a1a', -16, 0).ink(1); }); P.at(74, 66, 0.4, 0, () => A.bread(P)); };
A.smokehouse = (P) => { BG.dusk(P); hut(P, 50, 72, 1.05, { wall: '#6a5a4a', roof: '#3a3a32', chimney: true }); for (let i = 0; i < 3; i++) P.curve(56 + i * 3, 20, 50 + i * 4, 10, 58 + i * 3, 0, 2, 'rgba(200,200,200,0.35)'); };
A.oil_press = (P) => { BG.interior(P); P.at(50, 70, 1, 0, () => { P.rect(-20, -8, 40, 8, 1).fill('#6a4428').ink(1); P.rect(-4, -44, 8, 36).fill('#7a5232').ink(1); P.rect(-18, -44, 36, 6, 1).fill('#6a4428').ink(1); P.rect(-12, -22, 24, 12, 2).fill('#5a5048').ink(1); }); jar(P, 78, 70, 0.5, '#5a6a3a', '#c8b04a'); };
A.glassworks = (P) => { BG.dusk(P); furnace(P, 44, 72, 1.0, { color: '#7a6a62' }); P.at(76, 62, 0.6, 0, () => A.glass(P)); };
A.alchemy_lab = (P) => { BG.interior(P); bottle(P, 36, 60, 0.8, '#5ab05a', { glow: 'rgba(120,255,120,1)' }); bottle(P, 54, 58, 1, '#c33a8a', { glow: 'rgba(255,100,200,1)' }); bottle(P, 70, 60, 0.7, '#3a8ac3'); };
A.clock_workshop = (P) => { BG.interior(P); gearShape(P, 36, 40, 1.1, '#b8a070'); gearShape(P, 60, 52, 0.8, '#9a8a6a', 7); gearShape(P, 70, 30, 0.6, '#c9a45a', 6); };
A.dock = (P) => { BG.shore(P); P.at(50, 62, 1, 0, () => { P.rect(-30, -6, 60, 6, 1).lfill('#8a5a32', -30, -6, 30, 0).ink(1.1); for (let i = 0; i < 4; i++) P.rect(-28 + i * 18, 0, 4, 12).fill('#5a3a20').ink(0.9); }); boat(P, 62, 52, 0.55); };
A.field = (P) => { P.sky('#a4c0c8', '#efdcb0', 40); P.ground('#7a5a32', 40); for (let r = 0; r < 5; r++) P.line(-2, 44 + r * 7, 102, 42 + r * 8, 2.4, '#5a3e22'); for (let r = 0; r < 4; r++) for (let k = 0; k < 7; k++) wheat(P, 8 + k * 14 + (r % 2) * 7, 50 + r * 8, 0.35, 3); };
A.orchard = (P) => { BG.meadow(P); tree(P, 32, 70, 0.8, { fruit: '#c2402a' }); tree(P, 66, 72, 0.95, { fruit: '#c2402a' }); };
A.herb_garden = (P) => { BG.meadow(P); P.rect(14, 56, 72, 14, 2).fill('#6a4a2a').ink(1); for (let i = 0; i < 4; i++) herbs(P, 24 + i * 17, 64, 0.65, i % 2 ? '#5a9a4a' : '#7aaa5a'); };
A.pen = (P) => { BG.meadow(P); wall(P, 50, 72, 0.9, { wood: true }); quadruped(P, 54, 66, 0.55, { body: '#e8e0d0', len: 28, h: 13, legs: 11, horns: 'curl', ears: true }); };
A.granary = (P) => { BG.meadow(P); P.at(50, 72, 1, 0, () => { P.shadow(0, 0, 22, 4); P.rect(-18, -30, 36, 30, 2).lfill('#b89a6a', -18, -30, 18, 0).ink(1.2); P.path((c) => { c.arc(0, -30, 18, Math.PI, 0); c.closePath(); }).lfill('#7a3a26', -18, -48, 18, -30).ink(1.2); P.rect(-5, -14, 10, 14, 1).fill('#3a2414').ink(1); for (let i = 0; i < 4; i++) P.line(-18, -24 + i * 6, 18, -24 + i * 6, 0.5, 'rgba(30,20,10,0.35)'); }); };
A.market = (P) => { BG.day(P); tent(P, 36, 72, 0.9, '#d9c08a', { stripe: '#a33a2a', flag: '#a33a2a' }); P.at(66, 72, 1, 0, () => { P.rect(-14, -16, 28, 16, 1).fill('#8a5a32').ink(1); P.path((c) => { c.moveTo(-18, -16); c.lineTo(-14, -30); c.lineTo(14, -30); c.lineTo(18, -16); c.closePath(); }).fill('#3a6a8a').ink(1); for (const [x, y, cc] of [[-6, -20, '#c2402a'], [0, -21, '#e8c45a'], [6, -20, '#6a9a3a']]) P.circle(x, y, 2.6).fill(cc).ink(0.6); }); };
A.palisade = (P) => { BG.dusk(P); wall(P, 50, 72, 1, { wood: true }); };
A.stone_wall = (P) => { BG.dusk(P); wall(P, 50, 72, 1); };
A.infirmary = (P) => { BG.dusk(P); tent(P, 50, 72, 1.15, '#e8e0d0', { stripe: '#5a8a4a' }); herbs(P, 22, 72, 0.5); };
A.well = (P) => { BG.meadow(P); P.at(50, 72, 1, 0, () => { P.shadow(0, 0, 20, 4); P.ellipse(0, -10, 16, 5).fill('#1a2a30').ink(1); P.path((c) => { c.moveTo(-16, -10); c.lineTo(-16, 0); c.quadraticCurveTo(0, 6, 16, 0); c.lineTo(16, -10); }).lfill('#8a847a', -16, -10, 16, 6).ink(1.2); P.line(-14, -10, -14, -38, 2, '#6a4428'); P.line(14, -10, 14, -38, 2, '#6a4428'); P.poly([-18, -36, 0, -46, 18, -36]).fill('#6a3a26').ink(1); P.line(0, -36, 0, -20, 0.8); jar(P, 0, -14, 0.25, '#7a5a3a'); }); };
A.dike = (P) => { BG.marsh(P); P.path((c) => { c.moveTo(-2, 70); c.lineTo(10, 46); c.lineTo(90, 46); c.lineTo(102, 70); c.closePath(); }).lfill('#7a6a4a', 0, 46, 100, 70).ink(1.2); for (let k = 0; k < 9; k++) P.rect(10 + k * 9, 44, 8, 5, 1).fill('#8a847a').ink(0.7); };
A.festival_ground = (P) => { BG.night(P); P.rect(16, 58, 68, 10, 2).lfill('#8a5a32', 16, 58, 84, 68).ink(1.1); fireRing(P, 50, 60, 0.8); for (let i = 0; i < 7; i++) P.circle(16 + i * 11, 16 + (i % 2) * 6, 2.6).fill(['#e8c45a', '#c2402a', '#5a9aa8'][i % 3]).ink(0.5); P.curve(8, 14, 50, 26, 92, 14, 0.7, '#c9a45a'); };
A.steam_engine = (P) => { BG.interior(P); P.at(50, 70, 1, 0, () => { P.shadow(0, 0, 28, 4); P.rect(-26, -26, 30, 26, 4).lfill('#6a5a4a', -26, -26, 4, 0, 0.4).ink(1.2); P.circle(-11, -13, 7).fill('#3a3a42').ink(1); P.halo(-11, -13, 8, 'rgba(255,140,40,1)', 0.6); P.rect(4, -40, 7, 40).fill('#5a4a42').ink(1); gearShape(P, 18, -16, 0.7, '#c9a45a'); P.curve(8, -44, 2, -54, 10, -64, 2.4, 'rgba(230,230,230,0.5)'); }); };
A.barracks = (P) => { BG.dusk(P); tent(P, 40, 72, 0.9, '#8a7a5a', { flag: '#a33a2a' }); tent(P, 68, 72, 0.7, '#7a6a4a'); P.at(24, 72, 0.55, 0, () => item(P, 'spear', 'hold')); };
A.trading_post = (P) => { BG.day(P); hut(P, 40, 72, 0.95, { wall: '#a8783a', roof: '#3a6a8a' }); cart(P, 74, 72, 0.7); };
A.quest_altar = (P) => { BG.ember(P); P.at(50, 72, 1, 0, () => { P.shadow(0, 0, 24, 4); P.rect(-22, -12, 44, 12, 1).lfill('#8a847a', -22, -12, 22, 0).ink(1.2); P.rect(-16, -24, 32, 12, 1).lfill('#9a948a', -16, -24, 16, -12).ink(1.2); for (const x of [-18, 18]) { P.rect(x - 3, -46, 6, 22).fill('#8a847a').ink(1); flame(P, x, -46, 0.55); } P.circle(0, -34, 6).ink(1.2, '#c9a45a'); }); };
A.great_flame_site = (P) => { BG.ash(P); P.at(50, 72, 1, 0, () => { P.shadow(0, 0, 34, 5); P.ellipse(0, -4, 34, 8).lfill('#6a625a', -34, -12, 34, 4).ink(1.2); P.ellipse(0, -8, 24, 6).fill('#3a322e').ink(1); for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; P.rect(Math.cos(a) * 26 - 3, -24 + Math.sin(a) * 6, 6, 18).fill('#7a726a').ink(0.9); } P.halo(0, -10, 16, 'rgba(255,120,40,1)', 0.3); }); };
A.great_flame = (P) => { P.spot('#ffd88a', '#7a3a12'); P.rays(50, 30, 20, 80, 'rgba(255,250,210,0.22)', 5); A.great_flame_site_base(P); P.halo(50, 30, 50, 'rgba(255,200,90,1)', 0.8); flame(P, 50, 62, 3.2, true); };
A.great_flame_site_base = (P) => { P.at(50, 74, 1, 0, () => { P.ellipse(0, -4, 34, 8).lfill('#6a625a', -34, -12, 34, 4).ink(1.2); }); };

// knowledge-ish structures & misc
A.grave = (P) => { BG.night(P); grave(P, 50, 70, 1.25); };
A.snowman = (P) => { BG.snow(P); P.at(50, 72, 1, 0, () => { P.shadow(0, 0, 16, 4); P.circle(0, -12, 13).lfill('#f4f8fa', -13, -25, 13, 1, 0.2).ink(1.1); P.circle(0, -32, 9).lfill('#f4f8fa', -9, -41, 9, -23, 0.2).ink(1.1); P.circle(-3, -34, 1).fill(INK); P.circle(3, -34, 1).fill(INK); P.poly([0, -32, 7, -31, 0, -30]).fill('#e8742a'); P.rect(-7, -44, 14, 4, 1).fill('#2a2a2a'); P.rect(-4, -52, 8, 8).fill('#2a2a2a'); P.line(-9, -22, -20, -30, 1.4, '#6a4428'); P.line(9, -22, 20, -30, 1.4, '#6a4428'); }); };

// nodes ------------------------------------------------------------------------------------------
A.berry_bush = (P) => { BG.meadow(P); bush(P, 50, 70, 1.6, { berry: '#b0283a' }); };
A.tall_grass = (P) => { BG.meadow(P); grass(P, 40, 72, 1.3); grass(P, 64, 72, 1.1, '#9ab05a'); };
A.tree = (P) => { BG.meadow(P); tree(P, 50, 72, 1.2); };
A.pine = (P) => { BG.forest(P); pine(P, 50, 72, 1.15); };
A.dead_tree = (P) => { BG.ash(P); deadTree(P, 50, 72, 1.3); };
A.old_oak = (P) => { BG.forest(P); tree(P, 50, 74, 1.5, { leaf: '#4a7a2e', blobs: [[0, -36, 16], [-14, -30, 12], [14, -30, 12], [-8, -46, 11], [9, -45, 11], [0, -52, 9]] }); };
A.young_tree = (P) => { BG.meadow(P); P.ellipse(50, 70, 14, 4).fill('#5a4028'); P.curve(50, 70, 48, 54, 51, 40, 2, '#6a4428'); for (const [x, y] of [[44, 44], [57, 42], [50, 36]]) P.circle(x, y, 7).lfill('#7aaa4a', x - 7, y - 7, x + 7, y + 7).ink(0.9); };
A.rock = (P) => { BG.mountain(P); rocks(P, 50, 70, 1.2, '#8e8a80'); };
A.river = (P) => { P.sky('#9ab8c8', '#e2d4b0', 30); P.ground('#6a8a46', 30); P.path((c) => { c.moveTo(-2, 40); c.quadraticCurveTo(40, 30, 102, 46); c.lineTo(102, 66); c.quadraticCurveTo(40, 54, -2, 64); c.closePath(); }).vfill('#5a9ab0', '#2a5a70', 34, 66).ink(1); for (let i = 0; i < 8; i++) P.curve(8 + i * 12, 50, 12 + i * 12, 48, 16 + i * 12, 50, 0.8, 'rgba(255,255,255,0.5)'); fish(P, 60, 54, 0.5, { color: '#c8d8e0' }); reeds(P, 14, 74, 0.6); };
A.pond = (P) => { BG.meadow(P); pool(P, 50, 64, 1.25); reeds(P, 20, 66, 0.55); };
A.clay_pit = (P) => { BG.meadow(P); pit(P, 50, 64, 1.2, '#a8683a'); };
A.reed_bed = (P) => { BG.marsh(P); reeds(P, 36, 72, 1.1); reeds(P, 64, 72, 1); };
A.wild_wheat = (P) => { BG.meadow(P); wheat(P, 36, 72, 1.1); wheat(P, 62, 72, 1.25); };
A.herb_patch = (P) => { BG.forest(P); herbs(P, 38, 70, 1); herbs(P, 64, 72, 0.9, '#6aaa5a'); };
A.mushroom_ring = (P) => { BG.night(P); P.ellipse(50, 66, 30, 6).ink(1, 'rgba(180,255,190,0.25)'); for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; mushroom(P, 50 + Math.cos(a) * 26, 66 + Math.sin(a) * 6, 0.8, '#c8762a', { glow: 'rgba(170,255,180,1)' }); } };
A.beehive = (P) => { BG.forest(P); P.line(70, 0, 70, 30, 3, '#5a3a20'); P.line(30, 14, 90, 14, 4, '#5a3a20'); P.at(54, 50, 1, 0, () => { for (let i = 0; i < 5; i++) P.ellipse(0, -18 + i * 7, 13 - Math.abs(i - 2) * 2.4, 5).lfill('#d9a83a', -13, -22 + i * 7, 13, -14 + i * 7).ink(1); P.ellipse(0, 6, 3, 2).fill('#2a1a0a'); }); for (let i = 0; i < 5; i++) { const x = 24 + P.r() * 52, y = 30 + P.r() * 30; P.ellipse(x, y, 2, 1.4).fill('#e8b83a').ink(0.4); } };
A.copper_vein = (P) => { BG.cave(P); rocks(P, 50, 70, 1.2, '#6a5a4a', { gems: '#3fa58a', seed: 3 }); };
A.tin_vein = (P) => { BG.cave(P); rocks(P, 50, 70, 1.2, '#5a5a5a', { gems: '#d8dce2', seed: 4 }); };
A.iron_vein = (P) => { BG.cave(P); rocks(P, 50, 70, 1.2, '#6a4a3a', { veins: '#a83a2a', seed: 5 }); };
A.coal_seam = (P) => { BG.cave(P); rocks(P, 50, 70, 1.2, '#3a3632', { veins: '#111', seed: 6 }); };
A.salt_flat = (P) => { P.sky('#c8d8e0', '#efe8d8', 40); P.ground('#efebe2', 40, '#c8c0b0'); for (let i = 0; i < 12; i++) P.poly([10 + (i % 6) * 15, 48 + Math.floor(i / 6) * 14, 16 + (i % 6) * 15, 46 + Math.floor(i / 6) * 14, 20 + (i % 6) * 15, 52 + Math.floor(i / 6) * 14]).ink(0.6, 'rgba(120,110,90,0.5)'); pile(P, 50, 66, 0.6, '#ffffff'); };
A.sand_bank = (P) => { BG.shore(P); pile(P, 50, 70, 1.1, '#e0c890', { dotColor: '#b89a5a', dots: 30, dot: 0.6 }); };
A.tidepool = (P) => { BG.shore(P); pool(P, 50, 66, 1.05, { rim: '#6a6a62', c1: '#4a8a9a', c2: '#1e4a58' }); for (const [x, y] of [[36, 64], [62, 66]]) P.ellipse(x, y, 4, 2.4).fill('#2a3a5a').ink(0.6); P.circle(50, 64, 1.6).fill('#fff'); };
A.driftwood_shore = (P) => { BG.shore(P); P.at(50, 66, 1, -0.1, () => { P.path((c) => { c.moveTo(-30, 2); c.quadraticCurveTo(-10, -8, 30, -2); c.lineTo(28, 6); c.quadraticCurveTo(-10, 4, -30, 8); c.closePath(); }).lfill('#b8a488', -30, -8, 30, 8).ink(1.2); }); };
A.ice_shelf = (P) => { BG.snow(P); P.poly([10, 72, 18, 44, 40, 38, 62, 46, 86, 40, 92, 72]).lfill('#c8e6f2', 10, 38, 92, 72, 0.3).ink(1.2); for (const x of [30, 52, 72]) P.line(x, 46, x + 4, 70, 0.8, 'rgba(255,255,255,0.8)'); };
A.sulfur_vent = (P) => { BG.ash(P); rocks(P, 50, 72, 0.9, '#6a6040', { gems: '#e8d24a', seed: 9 }); for (let i = 0; i < 3; i++) P.curve(42 + i * 8, 52, 36 + i * 8, 34, 46 + i * 8, 16, 3, 'rgba(230,220,140,0.3)'); };
A.crystal_geode = (P) => { BG.cave(P); P.ellipse(50, 56, 30, 18).fill('#3a3432').ink(1.2); crystal(P, 50, 66, 1.2, '#b8a0f0', 'rgba(170,140,255,1)'); };
A.meteor_crater = (P) => { BG.night(P); pit(P, 50, 64, 1.25, '#4a4038', '#5a5048'); P.halo(50, 60, 16, 'rgba(160,200,255,1)', 0.6); P.blob([42, 62, 44, 54, 52, 52, 58, 56, 56, 64]).lfill('#4a5268', 42, 52, 58, 64).ink(1); P.line(70, 10, 90, 2, 1.6, 'rgba(255,255,255,0.6)'); };
A.ember_vein = (P) => { BG.cave(P); rocks(P, 50, 70, 1.2, '#3a2a26', { gems: '#ff8a3a', glow: 'rgba(255,140,50,1)', seed: 11 }); };
A.obsidian_flow = (P) => { BG.ash(P); P.blob([10, 70, 20, 48, 46, 44, 70, 50, 92, 70]).lfill('#2a1e2e', 10, 44, 92, 70, 0.4).ink(1.2); P.curve(26, 56, 46, 50, 70, 56, 1.2, 'rgba(200,160,255,0.35)'); };
A.ruins_rubble = (P) => { BG.dusk(P); rocks(P, 50, 72, 1, '#9a948a', { set: [[-14, -2, 10, 7], [12, -2, 12, 8], [0, -6, 8, 6]] }); P.rect(26, 34, 8, 34).lfill('#a8a294', 26, 34, 34, 68).ink(1.1); P.rect(24, 30, 12, 4).fill('#a8a294').ink(1); };
A.hot_spring = (P) => { BG.snow(P); pool(P, 50, 64, 1.25, { c1: '#6ab0b8', c2: '#2a6a78', steam: true }); };

// beasts -----------------------------------------------------------------------------------------
A.rabbit = (P) => { BG.meadow(P); P.at(50, 70, 1.3, 0, () => { P.shadow(0, 0, 12, 3); P.ellipse(4, -9, 10, 8).lfill('#b89a7a', -6, -17, 14, -1).ink(1.1); P.circle(-6, -14, 5.5).lfill('#b89a7a', -11, -19, -1, -9).ink(1); P.ellipse(-6, -24, 2, 7, -0.2).fill('#a88a6a').ink(0.9); P.ellipse(-2, -24, 2, 7, 0.3).fill('#a88a6a').ink(0.9); P.circle(-8, -15, 0.8).fill(INK); P.circle(14, -10, 2.4).fill('#f4efe4').ink(0.6); }); };
A.fowl = (P) => { BG.meadow(P); bird(P, 52, 70, 1.6, { body: '#8a6a4a' }); };
A.deer = (P) => { BG.forest(P); quadruped(P, 52, 72, 1, { body: '#a87a4a', len: 30, h: 13, legs: 17, head: 5.5, neck: 8, headUp: 12, tail: 2, ears: true, horns: 'antler' }); };
A.goat = (P) => { BG.mountain(P); quadruped(P, 52, 72, 1, { body: '#c8bca8', len: 28, h: 13, legs: 12, head: 5.5, tail: 2, horns: 'curl', ears: true }); };
A.horse = (P) => { BG.meadow(P); quadruped(P, 52, 72, 1.05, { body: '#8a5a3a', len: 34, h: 15, legs: 16, head: 6, neck: 8, headUp: 12, tail: 6, mane: true, ears: true }); };
A.boar = (P) => { BG.forest(P); quadruped(P, 52, 72, 1.05, { body: '#5a4232', len: 32, h: 16, legs: 9, head: 7, neck: 2, headUp: -2, tail: 2, ears: true, tusks: 1.8, mane: true }); };
A.mammoth = (P) => { BG.snow(P); quadruped(P, 54, 74, 1.1, { body: '#6a4a32', len: 40, h: 26, legs: 14, head: 10, neck: 0, headUp: 2, tail: 3, tusks: 3.4, mane: true, snout: false }); P.curve(24, 34, 14, 50, 22, 66, 6, INK); P.curve(24, 34, 14, 50, 22, 66, 4, '#6a4a32'); };
A.seal = (P) => { BG.shore(P); P.at(50, 70, 1.2, 0, () => { P.shadow(0, 0, 20, 4); P.path((c) => { c.moveTo(-20, -2); c.quadraticCurveTo(-18, -18, -4, -18); c.quadraticCurveTo(14, -18, 22, -4); c.lineTo(26, -8); c.lineTo(26, 2); c.closePath(); }).lfill('#7a7a82', -20, -18, 26, 2, 0.35).ink(1.1); P.circle(-12, -16, 6).lfill('#8a8a92', -18, -22, -6, -10).ink(1); P.circle(-14, -17, 0.9).fill(INK); P.line(-18, -14, -24, -15, 0.5); }); };

// enemies ----------------------------------------------------------------------------------------
A.wolf = (P) => { BG.night(P); quadruped(P, 52, 72, 1.05, { body: '#5a5a62', len: 30, h: 12, legs: 13, head: 6, neck: 6, headUp: 6, tail: -2, ears: true, fangs: true, eyeGlow: 'rgba(255,210,90,1)', eye: '#ffd060' }); };
A.alpha_wolf = (P) => { BG.night(P); P.moon(78, 14, 7); quadruped(P, 50, 74, 1.35, { body: '#8a8e96', len: 32, h: 14, legs: 13, head: 7, neck: 6, headUp: 8, tail: -3, ears: true, fangs: true, mane: true, eyeGlow: 'rgba(255,90,60,1)', eye: '#ff6040' }); };
A.bear = (P) => { BG.forest(P); quadruped(P, 52, 72, 1.1, { body: '#4a3222', len: 34, h: 20, legs: 11, head: 8, neck: 2, headUp: 2, tail: 0, ears: true, mane: true, fangs: true }); };
A.shade = (P) => { BG.shadow(P); shade(P, 50, 72, 1.15); };
A.wisp = (P) => { BG.shadow(P); wisp(P, 50, 38, 1.4, 'rgba(160,220,255,1)'); };
A.greater_shade = (P) => { BG.shadow(P); shade(P, 50, 74, 1.3, { color: '#2a1a3e', horns: true, eye: 'rgba(255,80,80,1)' }); };
A.thornling = (P) => { BG.forest(P); P.at(50, 70, 1.1, 0, () => { P.shadow(0, 0, 14, 3); for (let i = 0; i < 5; i++) P.curve(0, 0, -12 + i * 6, -16, -8 + i * 4, -34 + (i % 2) * 6, 2.6, '#4a5a2a'); for (let i = 0; i < 14; i++) { const y = -4 - i * 2.2, x = (i % 2 ? 1 : -1) * (4 + (i % 3)); P.poly([x, y, x + (x > 0 ? 3 : -3), y - 1, x, y - 2]).fill('#c8b878'); } P.halo(0, -22, 4, 'rgba(200,255,100,1)', 1); }); };
A.rotroot = (P) => { BG.forest(P); treebeast(P, 50, 74, 1.05); };
A.leech = (P) => { BG.marsh(P); for (const [x, y, r] of [[38, 62, 0.3], [62, 58, -0.4], [50, 70, 0]]) P.at(x, y, 1, r, () => { P.ellipse(0, 0, 12, 4.5).lfill('#3a2a32', -12, -4, 12, 4).ink(1); for (let i = 0; i < 4; i++) P.line(-6 + i * 4, -4, -6 + i * 4, 4, 0.5, 'rgba(200,150,170,0.5)'); P.circle(-11, 0, 2).fill('#8a2a3a'); }); };
A.croc = (P) => { BG.marsh(P); P.at(50, 64, 1, 0, () => { P.shadow(0, 4, 40, 5); P.path((c) => { c.moveTo(-40, 0); c.lineTo(-20, -6); c.quadraticCurveTo(0, -12, 20, -6); c.lineTo(40, 2); c.lineTo(20, 4); c.quadraticCurveTo(0, 6, -20, 4); c.closePath(); }).lfill('#4a5a32', -40, -12, 40, 6, 0.35).ink(1.2); for (let i = 0; i < 7; i++) P.poly([-14 + i * 5, -8, -12 + i * 5, -12, -10 + i * 5, -8]).fill('#3a4a26').ink(0.6); P.circle(-24, -8, 1.4).fill('#e8d050'); P.path((c) => { for (let i = 0; i < 5; i++) { c.moveTo(-38 + i * 3, 0); c.lineTo(-37 + i * 3, 2.4); } }).ink(1, '#fff'); }); };
A.croc_king = (P) => { A.croc(P); P.at(28, 50, 1, 0, () => { P.poly([-6, 0, -6, -6, -3, -3, 0, -8, 3, -3, 6, -6, 6, 0]).lfill('#d9a83a', -6, -8, 6, 0, 0.4).ink(1); }); P.halo(26, 56, 10, 'rgba(255,90,60,1)', 0.6); };
const bandit = (o) => (P) => { BG.dusk(P); figure(P, 48, 74, 1.02, { robe: '#3a3430', cape: '#2a2420', hat: 'hood', hatColor: '#1e1a18', ...o }); P.rect(41, 26, 14, 4, 1).fill('#7a2a22'); };
A.bandit = bandit({ item: 'sword' });
A.bandit_archer = bandit({ item: 'bow', robe: '#3a4232' });
A.bandit_chief = (P) => { BG.blood(P); figure(P, 48, 74, 1.1, { robe: '#4a2a22', cape: '#7a1a14', hat: 'band', hatColor: '#d9a83a', item: 'sword', beard: '#1a1210' }); };
A.cave_crawler = (P) => { BG.cave(P); beetle(P, 52, 70, 1.3); };
A.slag_golem = (P) => { BG.ember(P); golem(P, 50, 76, 1.05); };
A.frost_wolf = (P) => { BG.snow(P); quadruped(P, 52, 72, 1.05, { body: '#c8d4e0', len: 30, h: 12, legs: 13, head: 6, neck: 6, headUp: 6, tail: -2, ears: true, fangs: true, eyeGlow: 'rgba(120,200,255,1)' }); };
A.frost_wraith = (P) => { P.spot('#4a6a8a', '#0c1424'); shade(P, 50, 76, 1.3, { color: '#7a9aba', aura: 'rgba(160,220,255,1)', eye: 'rgba(160,240,255,1)', horns: true }); for (let i = 0; i < 6; i++) crystal(P, 14 + i * 15, 76, 0.35, '#d8f4ff'); };
A.harpy = (P) => { BG.sea(P); bird(P, 52, 56, 1.5, { body: '#5a4a5a', fly: true, beak: '#c8a050', eyeGlow: 'rgba(255,90,90,1)' }); };
A.sea_serpent = (P) => { BG.sea(P); serpent(P, 52, 72, 1.25); };
A.tentacle = (P) => { BG.sea(P); tentacle(P, 50, 76, 1); };
A.kraken = (P) => { P.spot('#2a4a5a', '#06121a'); P.water(52, '#1e4a58', '#0a1e26'); for (const [x, s, r] of [[22, 0.8, -0.3], [78, 0.9, 0.3], [40, 1, -0.1], [62, 1.05, 0.15]]) P.at(x, 78, 1, r, () => tentacle(P, 0, 0, s, '#4a2a4e')); P.halo(50, 44, 14, 'rgba(255,220,90,1)', 0.8); P.circle(50, 44, 5).fill('#ffe060'); P.ellipse(50, 44, 1.4, 4).fill('#1a0a0a'); };
A.ash_hound = (P) => { BG.ash(P); quadruped(P, 52, 72, 1.05, { body: '#2e2626', len: 30, h: 12, legs: 13, head: 6, neck: 6, headUp: 6, tail: -2, ears: true, fangs: true, eyeGlow: 'rgba(255,120,40,1)', eye: '#ff8030' }); };
A.ash_knight = (P) => { BG.ash(P); figure(P, 48, 74, 1.05, { robe: '#3a3436', robe2: '#5a5052', cape: '#2a1e1e', hat: 'helmet', hatColor: '#4a4448', item: 'sword', skin: '#2a2226', hair: '#1a1416' }); P.halo(45, 27, 4, 'rgba(255,120,40,1)', 1); P.halo(51, 27, 4, 'rgba(255,120,40,1)', 1); };
A.ash_king = (P) => { BG.ember(P); shade(P, 50, 78, 1.45, { color: '#2a1a1a', aura: 'rgba(255,90,40,1)', eye: 'rgba(255,140,60,1)' }); P.at(50, 14, 1.4, 0, () => P.poly([-8, 0, -8, -6, -4, -3, 0, -8, 4, -3, 8, -6, 8, 0]).lfill('#5a4a3a', -8, -8, 8, 0, 0.4).ink(1)); };
// lairs
A.wolf_den = (P) => { BG.night(P); rocks(P, 50, 72, 1.3, '#5a5650', { set: [[-18, -2, 14, 14], [18, -2, 14, 12], [0, -14, 18, 16]] }); P.path((c) => { c.moveTo(-10, 70); c.quadraticCurveTo(0, 52, 10, 70); }).fill('#0a0808'); P.halo(46, 62, 3, 'rgba(255,210,90,1)', 1); P.halo(54, 62, 3, 'rgba(255,210,90,1)', 1); };
A.bandit_camp = (P) => { BG.blood(P); wall(P, 50, 74, 0.95, { wood: true }); tent(P, 50, 56, 0.7, '#5a4a3a', { flag: '#7a1a14' }); };
A.shade_rift = (P) => { BG.shadow(P); P.path((c) => { c.moveTo(50, 8); c.quadraticCurveTo(40, 30, 52, 44); c.quadraticCurveTo(62, 58, 48, 72); c.quadraticCurveTo(70, 52, 58, 38); c.quadraticCurveTo(48, 26, 50, 8); }).fill('#0a0614'); P.halo(52, 40, 30, 'rgba(160,90,220,1)', 0.45); for (let i = 0; i < 4; i++) P.curve(50, 40, 30 + i * 12, 20, 24 + i * 16, 4, 1, 'rgba(190,140,255,0.4)'); };
A.serpent_nest = (P) => { BG.shore(P); rocks(P, 50, 72, 1.1, '#5a5a52'); serpent(P, 54, 60, 0.6); };

// regions & events -------------------------------------------------------------------------------
A.valley_depths = (P) => { P.sky('#a4c0c8', '#efdcb0', 50); P.mountains('#8a9a7a', 46, 20, 3, 21); P.hills('#7a9a5a', 54, 6, 4, 22); P.path((c) => { c.moveTo(40, 78); c.quadraticCurveTo(50, 60, 46, 50); c.lineTo(52, 50); c.quadraticCurveTo(58, 62, 62, 78); c.closePath(); }).fill('#5a9ab0'); tree(P, 20, 70, 0.55); tree(P, 80, 72, 0.6); };
A.deep_forest = (P) => { BG.forest(P); for (const [x, s] of [[16, 0.7], [36, 0.9], [62, 0.8], [84, 0.75]]) pine(P, x, 76, s, { leaf: '#24402e' }); P.fog(62, 0.4); P.halo(50, 50, 6, 'rgba(255,230,150,1)', 0.6); };
A.old_ruins = (P) => { P.sky('#8a7a8a', '#e2c49a', 56); P.ground('#6a6250', 60); for (const [x, h] of [[24, 34], [44, 44], [70, 26]]) { P.rect(x - 4, 66 - h, 8, h).lfill('#b8b0a0', x - 4, 66 - h, x + 4, 66).ink(1.1); P.rect(x - 6, 62 - h, 12, 4).fill('#b8b0a0').ink(1); } P.rect(36, 18, 30, 5).fill('#a8a090').ink(1); P.fog(60, 0.3); };
A.marsh_depths = (P) => { BG.marsh(P); reeds(P, 24, 74, 0.8); reeds(P, 76, 72, 0.7); deadTree(P, 52, 62, 0.6); };
A.cave = (P) => { P.sky('#6a7a8a', '#c8b89a', 60); P.mountains('#5a524a', 70, 50, 2, 31); P.path((c) => { c.moveTo(28, 76); c.quadraticCurveTo(28, 38, 50, 36); c.quadraticCurveTo(72, 38, 72, 76); c.closePath(); }).vfill('#0a0806', '#1a1410', 36, 76); P.halo(50, 60, 6, 'rgba(255,200,110,1)', 0.5); };
A.abandoned_mine = (P) => { A.cave(P); P.rect(30, 36, 4, 40).fill('#6a4428').ink(1); P.rect(66, 36, 4, 40).fill('#6a4428').ink(1); P.rect(26, 32, 48, 6).fill('#7a5232').ink(1); P.line(36, 76, 46, 50, 1.4, '#7a6a5a'); P.line(64, 76, 54, 50, 1.4, '#7a6a5a'); };
A.mountain_pass = (P) => { BG.mountain(P); P.path((c) => { c.moveTo(40, 78); c.quadraticCurveTo(50, 60, 50, 50); c.quadraticCurveTo(52, 60, 62, 78); c.closePath(); }).fill('#a8946e'); pine(P, 20, 72, 0.5); pine(P, 82, 74, 0.55); };
A.frozen_waste = (P) => { BG.snow(P); P.fog(58, 0.5, '235,242,248'); pine(P, 22, 70, 0.5, { snow: true }); quadruped(P, 70, 66, 0.4, { body: '#6a4a32', len: 40, h: 26, legs: 14, head: 10, tusks: 3, mane: true, snout: false }); };
A.ice_cave = (P) => { P.spot('#7aa8c8', '#0e1a28'); P.path((c) => { c.moveTo(20, 76); c.quadraticCurveTo(22, 30, 50, 26); c.quadraticCurveTo(78, 30, 80, 76); c.closePath(); }).vfill('#122030', '#203a50', 26, 76); for (let i = 0; i < 7; i++) P.poly([22 + i * 9, 28 + (i % 2) * 4, 25 + i * 9, 42 + (i % 3) * 4, 28 + i * 9, 30]).fill('#c8e8f8').ink(0.6); crystal(P, 50, 70, 0.6, '#a8e8ff', 'rgba(140,220,255,1)'); };
A.coast = (P) => { BG.shore(P); P.at(70, 58, 0.5, 0, () => boat(P, 0, 0, 1)); bird(P, 30, 30, 0.6, { body: '#e8e8e8', fly: true }); };
A.misty_isle = (P) => { BG.mist(P); P.path((c) => { c.moveTo(20, 56); c.quadraticCurveTo(40, 30, 60, 40); c.quadraticCurveTo(74, 34, 86, 56); c.closePath(); }).fill('#4a5a52'); tree(P, 48, 46, 0.4, { leaf: '#3a5a42' }); P.fog(48, 0.55); };
A.sunken_temple = (P) => { BG.mist(P); for (const [x, h] of [[30, 30], [50, 40], [70, 28]]) { P.rect(x - 4, 60 - h, 8, h).lfill('#8a9a96', x - 4, 60 - h, x + 4, 60).ink(1.1); } P.poly([20, 24, 50, 10, 80, 24]).fill('#7a8a86').ink(1.1); P.water(58, '#3a6a78', '#14303a'); P.halo(50, 40, 10, 'rgba(255,220,140,1)', 0.5); };
A.ash_wastes = (P) => { BG.ash(P); deadTree(P, 26, 72, 0.7); deadTree(P, 74, 70, 0.55); P.fog(56, 0.4, '120,90,80'); };
A.star_fall = (P) => { BG.night(P); for (let i = 0; i < 3; i++) P.line(20 + i * 24, 6 + i * 6, 34 + i * 24, 0 + i * 6, 1.4, 'rgba(255,255,255,0.7)'); pit(P, 50, 66, 1, '#3a3430', '#4a4038'); P.halo(50, 62, 14, 'rgba(160,200,255,1)', 0.6); };
A.bandit_trail = (P) => { BG.dusk(P); P.path((c) => { c.moveTo(30, 78); c.quadraticCurveTo(50, 58, 48, 46); c.lineTo(54, 46); c.quadraticCurveTo(58, 60, 70, 78); c.closePath(); }).fill('#8a7a5a'); for (let i = 0; i < 4; i++) P.ellipse(46 + (i % 2) * 6, 74 - i * 7, 2.4, 1.4).fill('#3a2a1a'); P.line(70, 50, 76, 30, 1.4, '#6a4428'); P.poly([76, 30, 90, 32, 76, 36]).fill('#7a1a14').ink(0.8); };
A.wolf_trail = (P) => { BG.night(P); P.path((c) => { c.moveTo(30, 78); c.quadraticCurveTo(50, 58, 48, 46); c.lineTo(54, 46); c.quadraticCurveTo(58, 60, 70, 78); c.closePath(); }).fill('#3a3a42'); for (let i = 0; i < 5; i++) { const x = 44 + (i % 2) * 8, y = 74 - i * 6; P.circle(x, y, 1.6).fill('#c8c8d0'); for (let k = 0; k < 3; k++) P.circle(x - 2 + k * 2, y - 2.4, 0.7).fill('#c8c8d0'); } };
A.treasure_site = (P) => { BG.dusk(P); P.path((c) => { c.moveTo(42, 60); c.lineTo(58, 70); c.moveTo(58, 60); c.lineTo(42, 70); }).ink(4, '#a33a2a'); P.at(70, 60, 0.6, 0.3, () => item(P, 'pick', 'hold')); };
A.wanderer = (P) => { BG.dusk(P); P.path((c) => { c.moveTo(30, 78); c.quadraticCurveTo(50, 60, 50, 50); c.lineTo(56, 50); c.quadraticCurveTo(60, 62, 72, 78); c.closePath(); }).fill('#8a7a5a'); figure(P, 52, 70, 0.75, { robe: '#6a5a4a', cape: '#5a4a3a', hat: 'hood', hatColor: '#4a3a2a', item: 'staff' }); };
A.caravan = (P) => { BG.day(P); cart(P, 50, 72, 1.15); quadruped(P, 84, 72, 0.5, { body: '#8a6a4a', len: 30, h: 14, legs: 13, head: 6, horns: 'curl' }); };
A.omen = (P) => { P.sky('#2a1a3a', '#a85a4a', 60); P.hills('#2a1e2a', 60, 5, 4, 41); P.halo(50, 26, 26, 'rgba(255,200,140,1)', 0.45); P.at(50, 26, 1, 0, () => { P.path((c) => { c.moveTo(-16, 0); c.quadraticCurveTo(0, -12, 16, 0); c.quadraticCurveTo(0, 12, -16, 0); c.closePath(); }).fill('#f6e8d0').ink(1.1); P.circle(0, 0, 5).fill('#7a2a1a'); P.circle(0, 0, 2).fill('#1a0a0a'); }); };
A.refugees = (P) => { BG.dusk(P); figure(P, 34, 72, 0.7, { robe: '#6a5a4a', hat: 'hood', hatColor: '#4a3a2a' }); figure(P, 54, 74, 0.78, { robe: '#5a6a7a', item: 'staff' }); figure(P, 70, 72, 0.5, { robe: '#a8703a' }); };

// ---------------------------------------------------------------- entry ---------------------------
export function hasArt(id) { return !!A[id] || !!FOLK[id] || id === 'automaton'; }

/** paint a card's illustration into the art window (0..100 × 0..76) */
export function paintArt(P, id) {
  const def = CARDS[id];
  const bgName = KIND_BG[def.kind] || 'dusk';
  if (def.kind === 'folk') {
    BG[def.id === 'automaton' ? 'interior' : 'dusk'](P);
    drawFolk(P, id);
  } else if (A[id]) {
    // structures, nodes, regions, enemies paint their own scene; objects get the kind backdrop
    const selfScene = ['node', 'structure', 'region', 'enemy', 'lair', 'beast', 'wonder', 'event', 'misc'].includes(def.kind) || ['star_chart', 'boat', 'raft', 'saddle_horse', 'domestic_goat', 'hen', 'fishing_rod'].includes(id);
    if (!selfScene) BG[bgName](P);
    A[id](P);
  } else {
    BG[bgName](P);
    P.circle(50, 40, 16).fill('rgba(255,255,255,0.2)').ink(1);
  }
  P.grain(0.08);
  P.vignette(0.35);
}

export const ART_IDS = Object.keys(A);
