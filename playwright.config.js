import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';

const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
export default defineConfig({
  testDir: './tests/browser',
  outputDir: './output/browser-results',
  workers: 1,
  globalSetup: './tests/browser/server.js',
  testMatch: '**/*.spec.js',
  timeout: 30_000,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5189',
    viewport: { width: 1280, height: 900 },
    launchOptions: { executablePath: process.env.CHROME_PATH || (existsSync(chrome) ? chrome : undefined) },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
