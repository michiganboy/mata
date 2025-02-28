import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import dotenv from 'dotenv';

// Load environment-specific variables
const env = process.env.ENV || 'qa';
dotenv.config({ path: path.resolve(__dirname, `env/.env.${env}`) });

// Define environment-specific configuration with optional properties
const envConfig = {
  site: process.env.SITE,
  bypassLoginAll: process.env.BYPASS_LOGIN_ALL === 'true' || undefined,
  bypassLoginSites: process.env.BYPASS_LOGIN_SITES?.split(','),
  path: process.env.SINGLE_PAGE_PATH,
  rulesets: process.env.RULESETS,
  env: env,
};

export default defineConfig({
  globalSetup: './global-setup',
  globalTeardown: './global-teardown',
  testDir: './tests',
  timeout: 0,
  reporter: [['html', { outputFolder: 'playwright-report' }], ['dot']],
  fullyParallel: true,
  reportSlowTests: null,
  use: {
    baseURL: process.env.BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...envConfig,
      },
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        ...envConfig,
      },
    },
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        ...envConfig,
      },
    },
  ],
});