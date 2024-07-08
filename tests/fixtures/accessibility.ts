import { Fixtures, Page, BrowserContext, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { generateAccessibilityReport, EnhancedAxeResults } from './reporter';
import { getSitesConfiguration, loadEnvironmentConfig, Site } from './siteConfiguration';
import { AuthenticationFixture } from './authentication';
import fs from 'fs';
import csv from 'csv-parser';

const targetSite = process.env.SITE;
const singlePagePath = process.env.SINGLE_PAGE_PATH;
const customRulesets = process.env.RULESETS?.split(',');
const bypassLoginAll = process.env.BYPASS_LOGIN_ALL === 'true';
const bypassLoginSites = process.env.BYPASS_LOGIN_SITES?.split(',') || [];
const environment = process.env.ENV || 'qa';

console.log("Command line arguments:");
console.log("Target site:", targetSite);
console.log("Single page path:", singlePagePath);
console.log("Custom rulesets:", customRulesets);
console.log("Bypass login all:", bypassLoginAll);
console.log("Bypass login sites:", bypassLoginSites);
console.log("Environment:", environment);

const defaultRulesets = ['wcag2a', 'wcag21aa', 'best-practice'];
const rulesets = customRulesets || defaultRulesets;

type PageInfo = {
  name: string;
  path: string;
};

export type AccessibilityFixture = {
  runAccessibilityAudits: () => Promise<number>;
};

type AccessibilityDeps = AuthenticationFixture & {
  page: Page;
  context: BrowserContext;
};

export const accessibilityFixture: Fixtures<AccessibilityFixture, AccessibilityDeps> = {
  runAccessibilityAudits: async ({ page, context, authenticate }, use) => {
    const runAudits = async () => {
      loadEnvironmentConfig(environment);

      if (singlePagePath && !targetSite) {
        throw new Error('To test a single page, you must specify a site using --site=SiteName');
      }

      const sites = getSitesConfiguration(targetSite);
      const allResults: EnhancedAxeResults[] = [];
      const errors: Error[] = [];

      for (const site of sites) {
        console.log(`Testing site: ${site.name}`);
        console.log(`Site configuration:`, site);
        
        const bypassLoginForSite = bypassLoginAll || bypassLoginSites.includes(site.name);
        
        console.log(`Bypass login for ${site.name}: ${bypassLoginForSite}`);

        try {
          if (site.requiresLogin && !bypassLoginForSite) {
            if (!site.username || !site.password) {
              throw new Error(`Missing login configuration for site ${site.name}`);
            }
            await authenticate(site.name, site.loginUrl!, site.username, site.password);
          }

          if (singlePagePath && targetSite === site.name) {
            await testSinglePage(page, site, singlePagePath, allResults);
          } else if (!singlePagePath) {
            await testAllPages(page, site, allResults);
          }
        } catch (error) {
          console.error(`Error testing site ${site.name}:`, error);
          errors.push(error as Error);
        }
      }

      const totalViolations = generateAccessibilityReport(allResults);
      console.log(`Total violations across all sites: ${totalViolations}`);

      if (errors.length > 0) {
        throw new AggregateError(errors, 'Errors occurred during accessibility testing');
      }

      return totalViolations;
    };

    await use(runAudits);
  },
};

async function testSinglePage(page: Page, site: Site, path: string, allResults: EnhancedAxeResults[]) {
  const fullUrl = new URL(path, site.baseUrl).toString();
  console.log(`Navigating to: ${fullUrl}`);
  await page.goto(fullUrl);
  
  const results = await runAxe(page, path, site.name);
  results.url = fullUrl;
  allResults.push(results);

  console.log(`Completed scan for ${site.name} - ${path} (${fullUrl})`);
}

async function testAllPages(page: Page, site: Site, allResults: EnhancedAxeResults[]) {
  const pages = await readPagesFromCSV(site.pathsCsvFile);
  
  for (const pageInfo of pages) {
    const fullUrl = new URL(pageInfo.path, site.baseUrl).toString();
    await page.goto(fullUrl);
    
    const results = await runAxe(page, pageInfo.name, site.name);
    results.url = fullUrl;
    allResults.push(results);

    console.log(`Completed scan for ${site.name} - ${pageInfo.name} (${fullUrl})`);
  }
}

async function runAxe(page: Page, pageName: string, siteName: string): Promise<EnhancedAxeResults> {
  let axeBuilder = new AxeBuilder({ page });
  
  if (rulesets.length > 0) {
    axeBuilder = axeBuilder.withTags(rulesets);
  }

  const results = await axeBuilder.analyze();
  
  return {
    ...results,
    pageName,
    siteName,
    url: page.url(),
  };
}

async function readPagesFromCSV(filePath: string): Promise<PageInfo[]> {
  return new Promise((resolve, reject) => {
    const pages: PageInfo[] = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        pages.push({
          name: row.name,
          path: row.path,
        });
      })
      .on('end', () => resolve(pages))
      .on('error', (error) => reject(error));
  });
}