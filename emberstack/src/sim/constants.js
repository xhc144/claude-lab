// Shared numbers for the simulation (world units; the renderer maps these to pixels).

export const CARD_W = 110;
export const CARD_H = 150;
export const STACK_DY = 27; // vertical offset of each card in a mixed stack
export const PILE_DY = 9; // offset between identical consecutive cards (piles)
export const MAX_STACK = 24;
export const MAX_PILE = 30;

export const DT = 0.1; // fixed simulation step (seconds)
export const DAY_LEN = 72; // seconds of sim time per day at 1×
export const DUSK = 0.7; // phase where light starts to fade
export const NIGHT = 0.78; // phase where full night begins
export const DAWN_END = 0.06; // phase where morning is fully bright

export const SEASONS = ['春', '夏', '秋', '冬'];
export const SEASON_NAMES = ['春季', '夏季', '秋季', '冬季'];

export const ACTION_INTERVAL = 0.38; // AI: sim seconds between two physical actions (≈ 160 APM)

/** y offsets of each card in a stack, given its def ids (identical neighbours are compressed) */
export function stackOffsets(defs) {
  const out = [0];
  let y = 0;
  for (let i = 1; i < defs.length; i++) {
    y += defs[i] === defs[i - 1] ? PILE_DY : STACK_DY;
    out.push(y);
  }
  return out;
}

export function stackHeight(defs) {
  const o = stackOffsets(defs);
  return o[o.length - 1] + CARD_H;
}
