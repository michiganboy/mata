import { Fixtures, Page, BrowserContext } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { generateAccessibilityReport, EnhancedAxeResults } from './reporter';
import {
  getSitesConfiguration,
  loadEnvironmentConfig,
  Site,
} from './siteConfiguration';
import { AuthenticationFixture } from './authentication';
import fs from 'fs';
import csv from 'csv-parser';
import type { AxeResults, Result, TestEnvironment } from 'axe-core';

const targetSite = process.env.SITE;
const singlePagePath = process.env.SINGLE_PAGE_PATH;
const customRulesets = process.env.RULESETS?.split(',');
const bypassLoginAll = process.env.BYPASS_LOGIN_ALL === 'true';
const bypassLoginSites = process.env.BYPASS_LOGIN_SITES?.split(',') || [];
const environment = process.env.ENV || 'qa';

console.log('Command line arguments:');
console.log('Target site:', targetSite);
console.log('Single page path:', singlePagePath);
console.log('Custom rulesets:', customRulesets);
console.log('Bypass login all:', bypassLoginAll);
console.log('Bypass login sites:', bypassLoginSites);
console.log('Environment:', environment);

const defaultRulesets = ['wcag22aa', 'best-practice'];
const rulesets = customRulesets || defaultRulesets;

type PageInfo = {
  name: string;
  path: string;
};

export type AccessibilityFixture = {
  runAccessibilityAudits: (browserName: string) => Promise<number>;
};

type AccessibilityDeps = AuthenticationFixture & {
  page: Page;
  context: BrowserContext;
};

export const accessibilityFixture: Fixtures<AccessibilityFixture, AccessibilityDeps> = {
  runAccessibilityAudits: async ({ page, context, authenticate }, use) => {
    const runAudits = async (browserName: string) => {
      console.log(`Running accessibility audits in ${browserName}`);
      loadEnvironmentConfig(environment);

      if (singlePagePath && !targetSite) {
        throw new Error('To test a single page, you must specify a site using --site=SiteName');
      }

      await context.setDefaultTimeout(0);
      await context.setDefaultNavigationTimeout(0);
      await page.setDefaultTimeout(0);
      await page.setDefaultNavigationTimeout(0);

      const sites = getSitesConfiguration(targetSite);
      const allResults: EnhancedAxeResults[] = [];

      try {
        let totalPagesAcrossSites = 0;
        let completedPagesTotal = 0;

        // First, calculate total pages across all sites
        for (const site of sites) {
          if (!singlePagePath) {
            const pages = await readPagesFromCSV(site.pathsCsvFile);
            totalPagesAcrossSites += pages.length;
          }
        }

        if (singlePagePath) {
          totalPagesAcrossSites = 1;
        }

        console.log(`[${browserName}] Total pages to scan across all sites: ${totalPagesAcrossSites}`);

        for (const site of sites) {
          console.log(`[${browserName}] Testing site: ${site.name}`);
          
          const bypassLoginForSite = bypassLoginAll || bypassLoginSites.includes(site.name);
          console.log(`[${browserName}] Bypass login for ${site.name}: ${bypassLoginForSite}`);
          
          if (site.requiresLogin && !bypassLoginForSite) {
            if (!site.username || !site.password) {
              throw new Error(`Missing login configuration for site ${site.name}`);
            }
            await authenticate(site.name, site.loginUrl!, site.username, site.password);
          }

          if (singlePagePath && targetSite === site.name) {
            await testSinglePage(page, site, singlePagePath, allResults, browserName);
            completedPagesTotal++;
            console.log(`[${browserName}] Overall progress: ${completedPagesTotal}/${totalPagesAcrossSites} pages scanned`);
          } else if (!singlePagePath) {
            const incrementProgress = () => {
              completedPagesTotal++;
              console.log(`[${browserName}] Overall progress: ${completedPagesTotal}/${totalPagesAcrossSites} pages scanned`);
            };
            await testAllPages(page, site, allResults, browserName, incrementProgress);
          }
        }

        console.log(`[${browserName}] Completed all scans (${completedPagesTotal}/${totalPagesAcrossSites})`);
        return generateAccessibilityReport(allResults, browserName);
      } catch (error) {
        console.error(`[${browserName}] Error during accessibility testing:`, error);
        throw error;
      }
    };

    await use(runAudits);
  },
};

async function testSinglePage(
  page: Page,
  site: Site,
  path: string,
  allResults: EnhancedAxeResults[],
  browserName: string
) {
  const fullUrl = new URL(path, site.baseUrl).toString();
  console.log(`[${browserName}] Navigating to: ${fullUrl}`);
  
  try {
    // For WebKit, use domcontentloaded, for others use load
    const loadState = browserName.toLowerCase().includes('webkit') ? 'domcontentloaded' : 'load';
    
    const response = await page.goto(fullUrl, {
      waitUntil: loadState,
      timeout: 0
    });

    if (!response?.ok()) {
      console.error(`[${browserName}] Failed to load page: ${fullUrl}, status: ${response?.status()}`);
      return;
    }

    if (browserName.toLowerCase().includes('webkit')) {
      // For WebKit, wait for any animations or transitions to complete
      await page.waitForLoadState('domcontentloaded', { timeout: 0 });
      // Small additional wait to ensure page is stable
      await new Promise(resolve => setTimeout(resolve, 1000));
    } else {
      await page.waitForLoadState('networkidle', { timeout: 0 });
    }
    
    const results = await runAxe(page, path, site.name);
    allResults.push(results);

    console.log(`[${browserName}] Completed scan for ${site.name} - ${path} (${fullUrl})`);
  } catch (error) {
    console.error(`[${browserName}] Error testing page ${path} for site ${site.name}:`, error);
  }
}

async function testAllPages(
  page: Page,
  site: Site,
  allResults: EnhancedAxeResults[],
  browserName: string,
  incrementProgress: () => void
) {
  try {
    const pages = await readPagesFromCSV(site.pathsCsvFile);
    const totalPages = pages.length;
    let completedPages = 0;
    
    console.log(`[${browserName}] Starting scan of ${totalPages} pages for ${site.name}`);
    
    for (const pageInfo of pages) {
      const fullUrl = new URL(pageInfo.path, site.baseUrl).toString();
      
      try {
        // For WebKit, use domcontentloaded, for others use load
        const loadState = browserName.toLowerCase().includes('webkit') ? 'domcontentloaded' : 'load';
        
        const response = await page.goto(fullUrl, {
          waitUntil: loadState,
          timeout: 0
        });

        if (!response?.ok()) {
          console.error(`[${browserName}] Failed to load page: ${fullUrl}, status: ${response?.status()}`);
          continue;
        }

        if (browserName.toLowerCase().includes('webkit')) {
          // For WebKit, wait for any animations or transitions to complete
          await page.waitForLoadState('domcontentloaded', { timeout: 0 });
          // Small additional wait to ensure page is stable
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          await page.waitForLoadState('networkidle', { timeout: 0 });
        }
        
        const results = await runAxe(page, pageInfo.name, site.name);
        allResults.push(results);

        completedPages++;
        incrementProgress();
        console.log(`[${browserName}] Completed scan ${completedPages}/${totalPages} for ${site.name} - ${pageInfo.name} (${fullUrl})`);
      } catch (pageError) {
        console.error(`[${browserName}] Error testing page ${pageInfo.name} (${fullUrl}):`, pageError);
        continue;
      }
    }
  } catch (error) {
    console.error(`[${browserName}] Error testing pages for site ${site.name}:`, error);
  }
}

async function runAxe(
  page: Page,
  pageName: string,
  siteName: string
): Promise<EnhancedAxeResults> {
  try {
    let axeBuilder = new AxeBuilder({ page });

    if (rulesets.length > 0) {
      axeBuilder = axeBuilder.withTags(rulesets);
    }

    const results = await axeBuilder.analyze();
    const url = page.url();

    return {
      ...results,
      pageName,
      siteName,
      url
    };
  } catch (error) {
    console.error(`Error running axe analysis for ${pageName}:`, error);
    const url = page.url();
    
    return {
      pageName,
      siteName,
      url,
      violations: [],
      passes: [],
      incomplete: [],
      inapplicable: [],
      timestamp: new Date().toISOString(),
      testEngine: { name: 'axe-core', version: 'unknown' },
      testRunner: { name: 'playwright' },
      testEnvironment: {
        orientationAngle: 0,
        orientationType: 'landscape-primary',
        windowHeight: 0,
        windowWidth: 0,
        userAgent: navigator.userAgent
      },
      toolOptions: {}
    };
  }
}

async function readPagesFromCSV(filePath: string): Promise<PageInfo[]> {
  return new Promise((resolve, reject) => {
    const pages: PageInfo[] = [];
    const stream = fs.createReadStream(filePath);
    
    stream
      .pipe(csv())
      .on('data', (row) => {
        pages.push({
          name: row.name,
          path: row.path,
        });
      })
      .on('end', () => {
        stream.destroy();
        resolve(pages);
      })
      .on('error', (error) => {
        stream.destroy();
        reject(error);
      });

    stream.on('error', (error) => {
      stream.destroy();
      reject(error);
    });
  });
}