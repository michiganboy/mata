import { AxeResults, Result, NodeResult } from 'axe-core';
import fs from 'fs';
import path from 'path';

export interface EnhancedAxeResults extends AxeResults {
  pageName: string;
  siteName: string;
  url: string;
  browser?: string; // Added browser property
}

interface EnhancedResultItem extends Result {
  siteName: string;
  pageName: string;
  pageUrl: string;
  browser?: string;
}

type EnhancedResults = {
  passes: EnhancedResultItem[];
  violations: EnhancedResultItem[];
  incomplete: EnhancedResultItem[];
  inapplicable: EnhancedResultItem[];
};

// Store results for each browser
const browserResults: { [browserName: string]: EnhancedAxeResults[] } = {};

export function generateAccessibilityReport(
  results: EnhancedAxeResults[],
  browserName: string
): number {
  // Store the results for this browser
  browserResults[browserName] = results;
  
  // Combine results from all browsers
  const allResults: EnhancedAxeResults[] = [];
  
  for (const [browser, browserData] of Object.entries(browserResults)) {
    // Tag each result with browser info before adding to allResults
    browserData.forEach(result => {
      allResults.push({
        ...result,
        browser
      } as EnhancedAxeResults); // Added proper casting
    });
  }
  
  // Generate the combined report
  return generateCombinedReport(allResults);
}

function generateCombinedReport(allResults: EnhancedAxeResults[]): number {
  const consolidatedResult: { [siteName: string]: EnhancedResults } = {};

  for (const result of allResults) {
    if (!consolidatedResult[result.siteName]) {
      consolidatedResult[result.siteName] = {
        passes: [],
        violations: [],
        incomplete: [],
        inapplicable: [],
      };
    }

    const siteResult = consolidatedResult[result.siteName];
    const browser = result.browser || 'unknown';

    ['passes', 'violations', 'incomplete', 'inapplicable'].forEach((resultType) => {
      (result[resultType as keyof AxeResults] as Result[]).forEach((item) => {
        // Create a unique key for each violation to check for duplicates
        const violationKey = `${item.id}_${result.url}_${item.nodes.map(n => n.target.join(',')).join('|')}`;
        
        // Check if this exact violation already exists
        const exists = siteResult[resultType as keyof EnhancedResults].some(
          existing => {
            const existingKey = `${existing.id}_${existing.pageUrl}_${existing.nodes.map(n => n.target.join(',')).join('|')}`;
            return existingKey === violationKey;
          }
        );

        if (!exists) {
          siteResult[resultType as keyof EnhancedResults].push({
            ...item,
            siteName: result.siteName,
            pageName: result.pageName,
            pageUrl: result.url,
            browser
          });
        }
      });
    });
  }

  const customReportHTML = generateCustomReport(consolidatedResult);

  const reportsDir = path.join(process.cwd(), 'accessibility-reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir);
  }

  const reportPath = path.join(
    reportsDir,
    'consolidated-multi-browser-accessibility-report.html'
  );
  fs.writeFileSync(reportPath, customReportHTML);

  console.log(`Consolidated report saved at ${reportPath}`);

  const totalViolations = Object.values(consolidatedResult).reduce(
    (sum, result) => sum + result.violations.length,
    0
  );

  return totalViolations;
}

function generateCustomReport(results: { [siteName: string]: EnhancedResults }): string {
  let html = `
    <html>
      <head>
        <title>Multi-Site Accessibility Audit Report</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 1800px; margin: 0 auto; padding: 20px; }
          h1, h2, h3 { color: #2c3e50; }
          .site-banner { background-color: #3498db; color: white; padding: 20px; margin-bottom: 20px; border-radius: 5px; width: 100%; box-sizing: border-box; }
          .site-banner h2 { margin: 0; }
          .site-stats { display: flex; justify-content: space-between; margin-top: 10px; }
          .site-stat { background-color: rgba(255,255,255,0.2); padding: 10px; border-radius: 5px; }
          .filters-sticky { position: sticky; top: 0; z-index: 2; background: white; padding: 15px; border-bottom: 1px solid #ddd; width: 100%; box-sizing: border-box; }
          .filters { 
            margin: 0; 
            padding: 15px; 
            background-color: #f5f5f5; 
            border-radius: 5px;
            display: flex;
            gap: 20px;
            align-items: center;
            flex-wrap: wrap;
            width: 100%;
            box-sizing: border-box;
          }
          .filter-group { 
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .filter-group label { 
            font-weight: bold;
            white-space: nowrap;
          }
          select { 
            padding: 8px; 
            border-radius: 4px; 
            border: 1px solid #ddd; 
            min-width: 200px;
            background-color: white;
          }
          table { border-collapse: collapse; width: 100%; margin-bottom: 20px; table-layout: fixed; }
          th, td { border: 1px solid #666; padding: 12px; text-align: left; word-wrap: break-word; }
          th { background-color: #f2f2f2; position: sticky; top: 0; z-index: 1; }
          .violation { background-color: #ffeded; }
          .pass { background-color: #edffed; }
          .impact-critical { color: #d00; font-weight: bold; }
          .impact-serious { color: #d60; font-weight: bold; }
          .impact-moderate { color: #850; font-weight: bold; }
          .impact-minor { color: #040; }
          .element { font-family: monospace; background-color: #f8f8f8; padding: 2px 4px; border-radius: 4px; display: inline-block; margin: 2px 0; }
          .learn-more { text-decoration: none; color: #0077be; }
          .learn-more:hover { text-decoration: underline; }
          .fix-suggestion { font-style: italic; color: #555; }
          .hidden { display: none; }
          .page-link { color: #0077be; text-decoration: none; }
          .page-link:hover { text-decoration: underline; }
          .browser-tag {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 0.8em;
            margin-left: 5px;
            color: white;
          }
          .browser-chromium { background-color: #4285F4; }
          .browser-firefox { background-color: #FF9400; }
          .browser-webkit { background-color: #1A73E8; }
        </style>
        <script>
          function getUniqueValues(selector, column) {
            const values = new Set();
            document.querySelectorAll('table[data-type="violations"] tr').forEach(row => {
              const cell = row.cells[column];
              if (cell && cell.textContent && row.cells[0].textContent !== 'Page Name') {
                if (selector === 'wcagFilter') {
                  const wcagTags = cell.textContent.split(', ');
                  wcagTags.forEach(tag => {
                    if (tag && (tag.startsWith('wcag') || tag.startsWith('best-practice'))) {
                      values.add(tag.trim());
                    }
                  });
                } else if (selector === 'browserFilter') {
                  // Get browser from the browser tag
                  const browserTag = row.querySelector('.browser-tag');
                  if (browserTag) {
                    values.add(browserTag.textContent.trim());
                  }
                } else {
                  values.add(cell.textContent.trim());
                }
              }
            });
            return Array.from(values).sort();
          }

          function populateFilters() {
            // Page filter (column 0)
            const pageFilter = document.getElementById('pageFilter');
            const pageValues = getUniqueValues('pageFilter', 0);
            pageFilter.innerHTML = '<option value="all">All Pages</option>';
            pageValues.forEach(value => {
              const option = document.createElement('option');
              option.value = value;
              option.textContent = value;
              pageFilter.appendChild(option);
            });

            // Impact filter (column 4)
            const impactFilter = document.getElementById('impactFilter');
            const impactValues = getUniqueValues('impactFilter', 4);
            impactFilter.innerHTML = '<option value="all">All Impacts</option>';
            impactValues.forEach(value => {
              const option = document.createElement('option');
              option.value = value;
              option.textContent = value;
              impactFilter.appendChild(option);
            });

            // WCAG filter (column 3)
            const wcagFilter = document.getElementById('wcagFilter');
            const wcagValues = getUniqueValues('wcagFilter', 3);
            wcagFilter.innerHTML = '<option value="all">All WCAG</option>';
            wcagValues.forEach(value => {
              const option = document.createElement('option');
              option.value = value;
              option.textContent = value;
              wcagFilter.appendChild(option);
            });

            // Browser filter
            const browserFilter = document.getElementById('browserFilter');
            const browserValues = getUniqueValues('browserFilter', 0);
            browserFilter.innerHTML = '<option value="all">All Browsers</option>';
            browserValues.forEach(value => {
              const option = document.createElement('option');
              option.value = value;
              option.textContent = value;
              browserFilter.appendChild(option);
            });
          }

          function filterTables() {
            const pageFilter = document.getElementById('pageFilter').value;
            const impactFilter = document.getElementById('impactFilter').value;
            const wcagFilter = document.getElementById('wcagFilter').value;
            const browserFilter = document.getElementById('browserFilter').value;
            
            document.querySelectorAll('table').forEach(table => {
              const isViolationsTable = table.getAttribute('data-type') === 'violations';
              const rows = table.getElementsByTagName('tr');
              
              for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                const pageName = row.cells[0].textContent.trim().split(' ')[0]; // Remove browser tag from page name
                let matchesFilters = true;

                if (isViolationsTable) {
                  const impact = row.cells[4].textContent.trim();
                  const wcagTags = row.cells[3].textContent.split(', ');
                  const browserTag = row.querySelector('.browser-tag');
                  const browser = browserTag ? browserTag.textContent.trim() : '';

                  matchesFilters = (
                    (pageFilter === 'all' || pageName === pageFilter) &&
                    (impactFilter === 'all' || impact === impactFilter) &&
                    (wcagFilter === 'all' || wcagTags.some(tag => tag.trim() === wcagFilter)) &&
                    (browserFilter === 'all' || browser === browserFilter)
                  );
                } else {
                  matchesFilters = pageFilter === 'all' || pageName === pageFilter;
                }
                
                row.classList.toggle('hidden', !matchesFilters);
              }
            });

            updateVisibleCounts();
          }

          function updateVisibleCounts() {
            document.querySelectorAll('.site-banner').forEach(banner => {
              const siteName = banner.querySelector('h2').textContent.split('(')[0].trim();
              const violationsTable = document.querySelector(\`table[data-site="\${siteName}"][data-type="violations"]\`);
              const passesTable = document.querySelector(\`table[data-site="\${siteName}"][data-type="passes"]\`);
              
              const visibleViolations = violationsTable.querySelectorAll('tr:not(.hidden)').length - 1;
              const visiblePasses = passesTable.querySelectorAll('tr:not(.hidden)').length - 1;
              
              banner.querySelector('.violations-count').textContent = \`Filtered Violations: \${visibleViolations}\`;
              banner.querySelector('.passes-count').textContent = \`Filtered Passes: \${visiblePasses}\`;
            });
          }

          document.addEventListener('DOMContentLoaded', () => {
            populateFilters();
            document.querySelectorAll('select').forEach(select => {
              select.addEventListener('change', filterTables);
            });
          });
        </script>
      </head>
      <body>
        <h1>Multi-Site Accessibility Audit Report</h1>
        <p>Generated on: ${new Date().toISOString()}</p>

        <div class="filters-sticky">
          <div class="filters">
            <div class="filter-group">
              <label for="pageFilter">Filter by Page:</label>
              <select id="pageFilter">
                <option value="all">All Pages</option>
              </select>
            </div>
            <div class="filter-group">
              <label for="impactFilter">Filter by Impact:</label>
              <select id="impactFilter">
                <option value="all">All Impacts</option>
              </select>
            </div>
            <div class="filter-group">
              <label for="wcagFilter">Filter by WCAG:</label>
              <select id="wcagFilter">
                <option value="all">All WCAG</option>
              </select>
            </div>
            <div class="filter-group">
              <label for="browserFilter">Filter by Browser:</label>
              <select id="browserFilter">
                <option value="all">All Browsers</option>
              </select>
            </div>
          </div>
        </div>
  `;

  for (const [siteName, siteResults] of Object.entries(results)) {
    const baseDomain = new URL(siteResults.violations[0]?.pageUrl || '').hostname;
    const totalPages = new Set([
      ...siteResults.violations.map((v) => v.pageUrl),
      ...siteResults.passes.map((p) => p.pageUrl),
    ]).size;

    html += `
        <div class="site-banner">
          <h2>${siteName} (${baseDomain})</h2>
          <div class="site-stats">
            <span class="site-stat">Pages Scanned: ${totalPages}</span>
            <span class="site-stat violations-count">Total Violations: ${siteResults.violations.length}</span>
            <span class="site-stat passes-count">Total Passes: ${siteResults.passes.length}</span>
          </div>
        </div>
        <h3>Violations</h3>
        <table data-site="${siteName}" data-type="violations">
          <tr>
            <th style="width: 10%;">Page Name</th>
            <th style="width: 10%;">Path</th>
            <th style="width: 10%;">Rule ID</th>
            <th style="width: 10%;">WCAG</th>
            <th style="width: 5%;">Impact</th>
            <th style="width: 15%;">Description</th>
            <th style="width: 20%;">Elements</th>
            <th style="width: 10%;">Fix Suggestion</th>
            <th style="width: 5%;">Count</th>
          </tr>
    `;

    siteResults.violations.forEach((violation) => {
      const parsedUrl = new URL(violation.pageUrl);
      const browser = violation.browser || 'unknown';
      
      html += `
        <tr class="violation">
          <td>${violation.pageName} <span class="browser-tag browser-${browser.toLowerCase()}">${browser}</span></td>
          <td><a href="${violation.pageUrl}" class="page-link" target="_blank">${parsedUrl.pathname}</a></td>
          <td>${violation.id} <a href="https://dequeuniversity.com/rules/axe/4.9/${
        violation.id
      }?application=playwright" target="_blank" class="learn-more">Learn More</a></td>
          <td>${violation.tags
            .filter((tag) => tag.startsWith('wcag') || tag.startsWith('best-practice'))
            .join(', ')}</td>
          <td class="impact-${violation.impact}">${violation.impact}</td>
          <td>${violation.description}</td>
          <td>${formatNodes(violation.nodes)}</td>
          <td class="fix-suggestion">${violation.nodes[0]?.failureSummary || 'N/A'}</td>
          <td>${violation.nodes.length}</td>
        </tr>
      `;
    });

    html += `
        </table>
        <h3>Passes</h3>
        <table data-site="${siteName}" data-type="passes">
          <tr>
            <th style="width: 20%;">Page Name</th>
            <th style="width: 20%;">Path</th>
            <th style="width: 20%;">Rule ID</th>
            <th style="width: 40%;">Description</th>
          </tr>
    `;

    siteResults.passes.forEach((pass) => {
      const parsedUrl = new URL(pass.pageUrl);
      html += `
        <tr class="pass">
          <td>${pass.pageName}</td>
          <td><a href="${pass.pageUrl}" class="page-link" target="_blank">${parsedUrl.pathname}</a></td>
          <td>${pass.id}</td>
          <td>${pass.description}</td>
        </tr>
      `;
    });

    html += `
        </table>
    `;
  }

  html += `
      </body>
    </html>
  `;

  return html;
}

function formatNodes(nodes: NodeResult[]): string {
  return nodes
    .map((node) => `<span class="element">${node.target.join(' ')}</span>`)
    .join('');
}