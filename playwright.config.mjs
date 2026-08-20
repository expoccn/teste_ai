import { defineConfig } from '@playwright/test';

function browserHostResolverRules() {
  const rules = [];
  try {
    const frontendHost = new URL(process.env.FRONTEND_URL || 'https://claro-rj-am.2see.io').hostname;
    if (process.env.FRONTEND_RESOLVED_IP) rules.push(`MAP ${frontendHost} ${process.env.FRONTEND_RESOLVED_IP}`);
  } catch {}
  try {
    const n8nHost = new URL(process.env.N8N_URL || 'https://example.invalid').hostname;
    if (process.env.N8N_RESOLVED_IP) rules.push(`MAP ${n8nHost} ${process.env.N8N_RESOLVED_IP}`);
  } catch {}
  return rules;
}

const hostRules = browserHostResolverRules();

export default defineConfig({
  testDir: './tests',
  timeout: 300_000,
  expect: { timeout: 25_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'artifacts/playwright-results.json' }],
  ],
  use: {
    baseURL: process.env.FRONTEND_URL || 'https://claro-rj-am.2see.io',
    headless: true,
    viewport: { width: 1600, height: 1000 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 30_000,
    navigationTimeout: 75_000,
    launchOptions: {
      args: hostRules.length ? [`--host-resolver-rules=${hostRules.join(',')}`] : [],
    },
  },
  outputDir: 'test-results',
});
