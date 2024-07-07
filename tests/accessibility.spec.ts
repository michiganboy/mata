import { test, expect } from './fixtures';

test('Run accessibility tests on all pages across multiple sites', async ({ runAccessibilityAudits }) => {
  const totalViolations = await runAccessibilityAudits();
  expect(totalViolations).toBe(0);
  
  if (totalViolations > 0) {
    console.warn(`Found ${totalViolations} accessibility violations. Check the report for details.`);
  }
});