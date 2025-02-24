// global-teardown.ts
import fs from 'fs';
import path from 'path';
import { TestResults } from './global-setup';

const resultsPath = path.join(process.cwd(), 'test-results', 'accessibility-summary.json');

export default async function globalTeardown() {
  if (!fs.existsSync(resultsPath)) {
    return;
  }

  const results: TestResults = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
  const totalElapsedSeconds = (Date.now() - results.startTime) / 1000;
  const elapsedHours = Math.floor(totalElapsedSeconds / 3600);
  const elapsedMinutes = Math.floor((totalElapsedSeconds % 3600) / 60);
  const elapsedSeconds = Math.round(totalElapsedSeconds % 60);

  let totalTimeStr = '';
  if (elapsedHours > 0) {
    totalTimeStr += `${elapsedHours}h `;
  }
  totalTimeStr += `${elapsedMinutes}m ${elapsedSeconds}s`;

  console.log('\n=== Accessibility Test Summary ===');
  console.log('Browser Results:');
  Object.entries(results.violations).forEach(([browser, violations]) => {
    const time = results.timing[browser];
    const minutes = Math.floor(time / 60);
    const seconds = Math.round(time % 60);
    console.log(`  ${browser.padEnd(10)}: ${violations.toString().padStart(5)} violations found (${minutes}m ${seconds}s)`);
  });

  const totalViolations = Object.values(results.violations).reduce((sum, count) => sum + count, 0);
  console.log('\nTotals:');
  console.log(`  Total Violations: ${totalViolations}`);
  console.log(`  Unique Violations: ${Math.max(...Object.values(results.violations))}`);
  console.log(`  Total Elapsed Time: ${totalTimeStr}`);
  console.log(`  Report Location: ${process.cwd()}\\accessibility-reports\\consolidated-multi-browser-accessibility-report.html`);
  console.log('===============================\n');

  // Clean up results file
  fs.unlinkSync(resultsPath);
}