import { Fixtures, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { generateAccessibilityReport, EnhancedAxeResults } from './reporter';
import { getSitesConfiguration, loadEnvironmentConfig, Site } from './siteConfiguration';
import { AuthenticationFixture } from './authentication';
import fs from 'fs';
import csv from 'csv-parser';

const targetSite = process.argv.find(arg => arg.startsWith('--site='))?.split('=')[1];
const singlePagePath = process.argv.find(arg => arg.startsWith('--path='))?.split('=')[1];
const customRulesets = process.argv.find(arg => arg.startsWith('--rulesets='))?.split('=')[1]?.split(',');
const bypassLoginAll = process.argv.includes('--bypass-login');
const bypassLoginSites = process.argv
  .filter(arg => arg.startsWith('--bypass-login='))
  .map(arg => arg.split('=')[1]);
const environment = process.argv.find(arg => arg.startsWith('--env='))?.split('=')[1] || 'qa';

const defaultRulesets = ['wcag21a', 'wcag21aa', 'best-practice'];
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
};

export const accessibilityFixture: Fixtures<AccessibilityFixture, AccessibilityDeps> = {
  runAccessibilityAudits: async ({ page, authenticate }, use) => {
    const runAudits = async () => {
      loadEnvironmentConfig(environment);

      if (singlePagePath && !targetSite) {
        throw new Error('To test a single page, you must specify a site using --site=SiteName');
      }

      const sites = getSitesConfiguration(targetSite);
      const allResults: EnhancedAxeResults[] = [];

      for (const site of sites) {
        console.log(`Testing site: ${site.name}`);
        
        const bypassLoginForSite = bypassLoginAll || bypassLoginSites.includes(site.name);
        
        if (site.requiresLogin && !bypassLoginForSite) {
          await authenticate(site.name, site.loginUrl!, site.username!, site.password!);
        }

        if (singlePagePath && targetSite === site.name) {
          await testSinglePage(page, site, singlePagePath, allResults);
        } else if (!singlePagePath) {
          await testAllPages(page, site, allResults);
        }
      }

      return generateAccessibilityReport(allResults);
    };

    await use(runAudits);
  },
};

async function testSinglePage(page: Page, site: Site, path: string, allResults: EnhancedAxeResults[]) {
  const fullUrl = new URL(path, site.baseUrl).toString();
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