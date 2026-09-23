import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';

const executablePath = process.env.BROWSER_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
].find(existsSync);

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 7000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  outputDir: 'test_artifacts/playwright/results',
  reporter: [['list'], ['html', { outputFolder: 'test_artifacts/playwright/report', open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4310',
    browserName: 'chromium',
    headless: true,
    launchOptions: { executablePath, args: ['--disable-background-networking'] },
    viewport: { width: 1440, height: 1000 },
    serviceWorkers: 'block',
    screenshot: 'on',
    trace: 'retain-on-failure'
  },
  webServer: {
    command: 'node scripts/start_test_server.mjs',
    url: 'http://127.0.0.1:4310',
    reuseExistingServer: false,
    timeout: 30_000
  }
});
