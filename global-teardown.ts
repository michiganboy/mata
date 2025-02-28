// global-teardown.ts
import fs from 'fs';
import path from 'path';
import { TestResults } from './global-setup';

const resultsPath = path.join(process.cwd(), 'test-results', 'accessibility-summary.json');
const reportDataPath = path.join(process.cwd(), 'accessibility-reports', 'data', 'report-data.json');

export default async function globalTeardown() {
  if (!fs.existsSync(resultsPath)) {
    return;
  }

  const results: TestResults = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
  
  // Read the report data to get the verified browser counts
  if (fs.existsSync(reportDataPath)) {
    try {
      const reportData = JSON.parse(fs.readFileSync(reportDataPath, 'utf8'));
      
      // If the report data has verified browser counts, use them
      if (reportData && reportData.summary && reportData.summary.browserViolationCounts) {
        for (const [browser, count] of Object.entries(reportData.summary.browserViolationCounts)) {
          // Update the results with verified counts from the report
          results.violations[browser.toLowerCase()] = count as number;
        }
      }
    } catch (error) {
      console.error('Error reading report data:', error);
    }
  }

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
  // Calculate unique violations by reading the report data
  let uniqueViolations = Math.max(...Object.values(results.violations));
  
  // Try to get the more accurate total violations count from the report
  if (fs.existsSync(reportDataPath)) {
    try {
      const reportData = JSON.parse(fs.readFileSync(reportDataPath, 'utf8'));
      if (reportData && reportData.summary && reportData.summary.totalViolations) {
        uniqueViolations = reportData.summary.totalViolations;
      }
    } catch (error) {
      // Fallback to the original calculation if there's an error
    }
  }

  console.log('\nTotals:');
  console.log(`  Total Violations: ${totalViolations}`);
  console.log(`  Unique Violations: ${uniqueViolations}`);
  console.log(`  Total Elapsed Time: ${totalTimeStr}`);
  console.log(`  Report Location: ${process.cwd()}\\accessibility-reports\\report.html`);
  console.log('===============================\n');

  // Clean up results file
  fs.unlinkSync(resultsPath);
}