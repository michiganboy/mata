// global-setup.ts
import fs from 'fs';
import path from 'path';
import { PlaywrightTestConfig } from '@playwright/test';

export type TestResults = {
  violations: { [browser: string]: number };
  timing: { [browser: string]: number };
  startTime: number;
};

const resultsPath = path.join(process.cwd(), 'test-results', 'accessibility-summary.json');

// Global setup function
export default async function globalSetup(config: PlaywrightTestConfig) {
  // Log configuration settings
  console.log('Global setup config:');
  console.log('site:', config.projects?.[0].use?.site);
  console.log('bypassLoginAll:', config.projects?.[0].use?.bypassLoginAll);
  console.log('bypassLoginSites:', config.projects?.[0].use?.bypassLoginSites);
  console.log('path:', config.projects?.[0].use?.path);
  console.log('rulesets:', config.projects?.[0].use?.rulesets);

  // Initialize results file
  const results: TestResults = {
    violations: {},
    timing: {},
    startTime: Date.now()
  };

  // Ensure directory exists
  fs.mkdirSync(path.dirname(resultsPath), { recursive: true });
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
}

export async function saveResults(browser: string, violations: number, duration: number) {
  let results: TestResults;
  
  if (fs.existsSync(resultsPath)) {
    results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
  } else {
    results = {
      violations: {},
      timing: {},
      startTime: Date.now()
    };
    fs.mkdirSync(path.dirname(resultsPath), { recursive: true });
  }

  results.violations[browser] = violations;
  results.timing[browser] = duration;

  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
}