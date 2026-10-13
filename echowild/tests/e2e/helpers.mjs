import { expect } from '@playwright/test';

// ECHOWILD_APP=/dist/echowild.html runs the same tests against the single-file build
export const APP = process.env.ECHOWILD_APP || '/';

export function watchErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  return errors;
}

export async function openWorld(page, { seed = 20261012, fresh = true, rd = 3, mode = 'survival' } = {}) {
  const q = `autoplay&seed=${seed}&rd=${rd}${fresh ? '&fresh' : ''}${mode === 'creative' ? '&mode=creative' : ''}`;
  await page.goto(`${APP}${APP.includes('?') ? '&' : '?'}${q}`);
  await page.waitForFunction(() => window.__game && window.__game.ready, null, { timeout: 120_000 });
}

// run code inside the page with the game and a few modules at hand
export async function game(page, fn, arg) {
  return page.evaluate(`(${fn.toString()})(window.__game, ${JSON.stringify(arg ?? null)})`);
}

export async function expectNoErrors(errors) {
  expect(errors.filter((e) => !/favicon|AudioContext/.test(e))).toEqual([]);
}
