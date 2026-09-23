import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
export default defineConfig({
  testDir: '.', testMatch: 'measure_loading.spec.mjs', workers: 1, retries: 0, timeout: 30000,
  reporter: 'list', outputDir: '../test_artifacts/performance/runner',
  use: { baseURL: 'http://127.0.0.1:4310', headless: true, serviceWorkers: 'block',
    launchOptions: { executablePath: process.env.BROWSER_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync) } },
  webServer: { command: 'node scripts/measure_loading_server.mjs', cwd: process.cwd(), url: 'http://127.0.0.1:4310', reuseExistingServer: false, timeout: 30000 }
});
