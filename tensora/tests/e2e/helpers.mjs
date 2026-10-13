import { expect } from '@playwright/test';

/** App entry under test: '/' = source version, '/dist/tensora.html' = single-file build. */
export const APP = process.env.TENSORA_APP || '/';

/** Collect console errors and uncaught exceptions; call the returned check() at the end. */
export function watchErrors(page) {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)/.test(`${m.text()} ${m.location()?.url || ''}`)) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(`${e.message}\n${e.stack || ''}`));
  return () => expect(errors, errors.join('\n\n')).toEqual([]);
}

/** Open a route and wait until that page (and params) is mounted. */
export async function open(page, route = 'overview') {
  await page.goto(`${APP}#/${route}`, { waitUntil: 'commit' });
  await waitRoute(page, route);
}

export async function waitRoute(page, route) {
  const [id, ...params] = route.split('/');
  await page.waitForFunction(([i, p]) => window.__tensora?.page === i && (window.__tensora.params || []).join('/') === p, [id, params.join('/')]);
  await page.waitForTimeout(250);
}

/** Navigate inside the running app (same document). */
export async function go(page, route) {
  await page.evaluate((r) => { location.hash = '/' + r; }, route);
  await waitRoute(page, route);
}

export const ROUTES = ['overview', 'models', 'keys', 'usage', 'tokens', 'training', 'jobs', 'cluster', 'billing', 'settings'];
