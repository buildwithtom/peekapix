import { defineConfig } from '@playwright/test';

const port = Number(process.env.PEEKAPIX_FIXTURE_PORT || 4173);

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:' + port },
  webServer: {
    command: 'npm run fixture',
    url: 'http://127.0.0.1:' + port,
    reuseExistingServer: !process.env.CI,
  },
});
