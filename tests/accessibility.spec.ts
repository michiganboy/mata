// accessibility.spec.ts
import { test } from './fixtures';
import { saveResults } from '../global-setup';

test.describe('Accessibility Tests', () => {
  test.describe.configure({ timeout: 0 });

  test('Run accessibility tests on all pages across multiple sites', async ({ page, context, runAccessibilityAudits }, testInfo) => {
    const browserName = testInfo.project.name;
    console.log(`Starting test with browser: ${browserName}`);
    
    const startTime = Date.now();
    await page.setDefaultTimeout(0);
    await page.setDefaultNavigationTimeout(0);
    
    try {
      const totalViolations = await runAccessibilityAudits(browserName);
      const duration = (Date.now() - startTime) / 1000; // Convert to seconds
      
      // Save results for this browser
      await saveResults(browserName, totalViolations, duration);
      
      if (totalViolations > 0) {
        console.log(`Found ${totalViolations} accessibility violations in ${browserName}. Check the report for details.`);
      } else {
        console.log(`No accessibility violations found in ${browserName}.`);
      }
    } catch (error) {
      console.error(`Error in ${browserName} test:`, error);
      throw error;
    } finally {
      console.log(`Test completed for ${browserName}, cleaning up...`);
      try {
        const pages = context.pages();
        for (const p of pages) {
          try {
            if (!p.isClosed()) {
              await p.close().catch(() => {
                console.log(`Failed to close a page in ${browserName}, continuing cleanup...`);
              });
            }
          } catch (e) {
            console.warn(`Error while closing page in ${browserName}:`, e);
          }
        }
        
        if (context) {
          await context.close().catch(() => {
            console.log(`Failed to close context in ${browserName}, continuing...`);
          });
        }
      } catch (e) {
        console.warn(`Error during cleanup for ${browserName}:`, e);
      }
    }
  });
});