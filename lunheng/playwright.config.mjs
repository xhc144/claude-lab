import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_APP_PORT || 18848);

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: {
    command: 'node tools/e2e-server.mjs',
    url: `http://127.0.0.1:${PORT}/api/meta`,
    reuseExistingServer: false,
    timeout: 20_000,
  },
});
