// End-to-end tests run against the built site (dist/), served by scripts/serve.mjs.
import { defineConfig, devices } from '@playwright/test';

const PORT = 5187;
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120_000,
  fullyParallel: true,
  reporter: [['list']],
  use: { baseURL: `http://127.0.0.1:${PORT}/`, viewport: { width: 1440, height: 900 } },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: { command: `node scripts/serve.mjs --port ${PORT} --host 127.0.0.1`, url: `http://127.0.0.1:${PORT}/`, reuseExistingServer: false, timeout: 20_000 },
});
