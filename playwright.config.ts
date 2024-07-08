import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

// Load environment-specific .env file
const env = process.env.ENV || 'qa';
dotenv.config({ path: path.resolve(__dirname, `env/.env.${env}`) });

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    trace: 'on-first-retry',
    // Custom properties
    site: process.env.SITE,
    bypassLoginAll: process.env.BYPASS_LOGIN_ALL === 'true',
    bypassLoginSites: process.env.BYPASS_LOGIN_SITES ? process.env.BYPASS_LOGIN_SITES.split(',') : [],
    path: process.env.PATH,
    rulesets: process.env.RULESETS,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  // Global setup to run before all tests
  globalSetup: './global-setup.ts', // Updated path
});