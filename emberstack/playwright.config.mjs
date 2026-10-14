// End-to-end tests drive the real game in Chromium. EMBER_APP=/dist/emberstack.html tests the
// single-file build instead of the module sources.
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5190',
    viewport: { width: 1440, height: 860 },
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined },
  },
  webServer: {
    command: 'node scripts/serve.mjs --port 5190',
    url: 'http://127.0.0.1:5190/index.html',
    reuseExistingServer: true,
    timeout: 20000,
  },
});
