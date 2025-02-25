import { AxeResults, Result, NodeResult } from 'axe-core';
import fs from 'fs';
import path from 'path';

export interface EnhancedAxeResults extends AxeResults {
  pageName: string;
  siteName: string;
  url: string;
  browser?: string;
}

interface EnhancedResultItem extends Result {
  siteName: string;
  pageName: string;
  pageUrl: string;
  browser?: string;
}

type EnhancedResults = {
  violations: EnhancedResultItem[];
};

export function generateAccessibilityReport(
  results: EnhancedAxeResults[],
  browserName: string
): number {
  console.log(`\n=== BROWSER ${browserName} REPORTING ${results.length} RESULTS ===`);

  // Create directory for results if it doesn't exist
  const resultsDir = path.join(process.cwd(), 'accessibility-reports', 'browser-results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  // Tag each result with browser info
  const taggedResults = results.map(result => ({
    ...result,
    browser: browserName
  }));

  // Save this browser's results to disk
  const browserResultsFile = path.join(resultsDir, `${browserName}-results.json`);
  fs.writeFileSync(browserResultsFile, JSON.stringify(taggedResults, null, 2));

  // Read all browser result files
  const allResults: EnhancedAxeResults[] = [];
  const browserFiles = fs.readdirSync(resultsDir).filter(file => file.endsWith('-results.json'));

  console.log(`Found ${browserFiles.length} browser result files: ${browserFiles.join(', ')}`);

  for (const file of browserFiles) {
    try {
      const fileContent = fs.readFileSync(path.join(resultsDir, file), 'utf8');
      const fileResults = JSON.parse(fileContent) as EnhancedAxeResults[];
      const fileBrowser = file.replace('-results.json', '');

      console.log(`Adding ${fileResults.length} results from ${fileBrowser}`);
      allResults.push(...fileResults);
    } catch (error) {
      console.error(`Error processing browser file ${file}:`, error);
    }
  }

  console.log(`Total combined results: ${allResults.length}`);

  // Generate the combined report
  return generateCombinedReport(allResults);
}

function generateCombinedReport(allResults: EnhancedAxeResults[]): number {
  const consolidatedResult: { [siteName: string]: EnhancedResults } = {};

  for (const result of allResults) {
    if (!consolidatedResult[result.siteName]) {
      consolidatedResult[result.siteName] = {
        violations: []
      };
    }

    const siteResult = consolidatedResult[result.siteName];

    // Process violations only
    if (Array.isArray(result.violations)) {
      result.violations.forEach((item) => {
        // Create a unique key for each violation to check for duplicates
        const violationKey = `${item.id}_${result.url}_${item.nodes.map(n => n.target.join(',')).join('|')}`;

        // Check if this exact violation already exists
        const exists = siteResult.violations.some(
          existing => {
            const existingKey = `${existing.id}_${existing.pageUrl}_${existing.nodes.map(n => n.target.join(',')).join('|')}`;
            return existingKey === violationKey;
          }
        );

        if (!exists) {
          siteResult.violations.push({
            ...item,
            siteName: result.siteName,
            pageName: result.pageName,
            pageUrl: result.url,
            browser: result.browser
          });
        }
      });
    }
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
          body { 
            font-family: Arial, sans-serif; 
            line-height: 1.6; 
            color: #333;
            padding: 0;
            margin: 0;
          }
          .container {
            max-width: 1800px;
            margin: 0 auto;
            padding: 20px;
          }
          h1, h2, h3 { color: #2c3e50; }
          .site-section {
            margin-bottom: 40px;
          }
          .site-banner { 
            background-color: #3498db; 
            color: white; 
            padding: 20px; 
            margin-bottom: 20px; 
            border-radius: 5px; 
          }
          .site-banner h2 { margin: 0; }
          .site-stats { 
            display: flex; 
            justify-content: space-between; 
            margin-top: 10px; 
          }
          .site-stat { 
            background-color: rgba(255,255,255,0.2); 
            padding: 10px; 
            border-radius: 5px; 
          }
          .filters-sticky { 
            position: sticky; 
            top: 0; 
            z-index: 2; 
            background: white; 
            padding: 15px 0; 
            border-bottom: 1px solid #ddd; 
          }
          .filters { 
            background-color: #f5f5f5; 
            padding: 15px; 
            border-radius: 5px;
            display: flex;
            gap: 20px;
            align-items: center;
            flex-wrap: wrap;
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
            min-width: 180px;
            background-color: white;
          }
          table { 
            border-collapse: collapse; 
            width: 100%; 
            margin-bottom: 20px; 
            table-layout: fixed;
          }
          th, td { 
            border: 1px solid #666; 
            padding: 12px; 
            text-align: left; 
            word-wrap: break-word; 
          }
          th { 
            background-color: #f2f2f2; 
            position: sticky; 
            top: 0; 
            z-index: 1; 
          }
          .violation { background-color: #ffeded; }
          .impact-critical { color: #d00; font-weight: bold; }
          .impact-serious { color: #d60; font-weight: bold; }
          .impact-moderate { color: #850; font-weight: bold; }
          .impact-minor { color: #040; }
          .element { 
            font-family: monospace; 
            background-color: #f8f8f8; 
            padding: 2px 4px; 
            border-radius: 4px; 
            display: inline-block; 
            margin: 2px 0; 
          }
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
            color: white;
          }
          .browser-chromium { background-color: #4285F4; }
          .browser-firefox { background-color: #FF9400; }
          .browser-webkit { background-color: #1A73E8; }
          .custom-table-container {
            width: 100%;
            overflow-x: auto;
          }
          .custom-table {
            width: 100%;
          }
        </style>
        <script>
          function getUniqueValues(selector, column) {
            const values = new Set();
            // Check all tables across all sites for violations
            document.querySelectorAll('table[data-type="violations"] tbody tr').forEach(row => {
              const cell = row.cells[column];
              if (cell && cell.textContent) {
                if (selector === 'wcagFilter') {
                  const wcagTags = cell.textContent.split(', ');
                  wcagTags.forEach(tag => {
                    if (tag && (tag.startsWith('wcag') || tag.startsWith('best-practice'))) {
                      values.add(tag.trim());
                    }
                  });
                } else {
                  values.add(cell.textContent.trim());
                }
              }
            });
            return Array.from(values).sort();
          }

          function populateFilters() {
            // Site filter
            const siteFilter = document.getElementById('siteFilter');
            const siteValues = new Set();
            document.querySelectorAll('.site-section').forEach(section => {
              siteValues.add(section.getAttribute('data-site'));
            });
            siteFilter.innerHTML = '<option value="all">All Sites</option>';
            Array.from(siteValues).sort().forEach(value => {
              const option = document.createElement('option');
              option.value = value;
              option.textContent = value;
              siteFilter.appendChild(option);
            });

            // Browser filter (column 0)
            const browserFilter = document.getElementById('browserFilter');
            const browserValues = getUniqueValues('browserFilter', 0);
            browserFilter.innerHTML = '<option value="all">All Browsers</option>';
            browserValues.forEach(value => {
              const option = document.createElement('option');
              option.value = value;
              option.textContent = value;
              browserFilter.appendChild(option);
            });

            // Page filter (column 1)
            const pageFilter = document.getElementById('pageFilter');
            const pageValues = getUniqueValues('pageFilter', 1);
            pageFilter.innerHTML = '<option value="all">All Pages</option>';
            pageValues.forEach(value => {
              const option = document.createElement('option');
              option.value = value;
              option.textContent = value;
              pageFilter.appendChild(option);
            });

            // Impact filter (column 5)
            const impactFilter = document.getElementById('impactFilter');
            const impactValues = getUniqueValues('impactFilter', 5);
            impactFilter.innerHTML = '<option value="all">All Impacts</option>';
            impactValues.forEach(value => {
              const option = document.createElement('option');
              option.value = value;
              option.textContent = value;
              impactFilter.appendChild(option);
            });

            // WCAG filter (column 4)
            const wcagFilter = document.getElementById('wcagFilter');
            const wcagValues = getUniqueValues('wcagFilter', 4);
            wcagFilter.innerHTML = '<option value="all">All WCAG</option>';
            wcagValues.forEach(value => {
              const option = document.createElement('option');
              option.value = value;
              option.textContent = value;
              wcagFilter.appendChild(option);
            });
          }

          function filterTables() {
            const siteFilter = document.getElementById('siteFilter').value;
            const browserFilter = document.getElementById('browserFilter').value;
            const pageFilter = document.getElementById('pageFilter').value;
            const impactFilter = document.getElementById('impactFilter').value;
            const wcagFilter = document.getElementById('wcagFilter').value;
            
            // First filter site sections
            document.querySelectorAll('.site-section').forEach(section => {
              const siteName = section.getAttribute('data-site');
              const showSite = siteFilter === 'all' || siteFilter === siteName;
              section.classList.toggle('hidden', !showSite);
            });
            
            // Then filter rows within visible tables
            document.querySelectorAll('.site-section:not(.hidden) table').forEach(table => {
              const rows = table.querySelectorAll('tbody tr');
              
              rows.forEach(row => {
                const browser = row.cells[0].textContent.trim();
                const pageName = row.cells[1].textContent.trim();
                const impact = row.cells[5].textContent.trim();
                const wcagTags = row.cells[4].textContent.split(', ');

                const matchesFilters = (
                  (browserFilter === 'all' || browser === browserFilter) &&
                  (pageFilter === 'all' || pageName === pageFilter) &&
                  (impactFilter === 'all' || impact === impactFilter) &&
                  (wcagFilter === 'all' || wcagTags.some(tag => tag.trim() === wcagFilter))
                );
                
                row.classList.toggle('hidden', !matchesFilters);
              });
            });

            updateVisibleCounts();
          }

          function updateVisibleCounts() {
            document.querySelectorAll('.site-section:not(.hidden)').forEach(section => {
              const banner = section.querySelector('.site-banner');
              const violationsTable = section.querySelector('table[data-type="violations"]');
              
              if (violationsTable) {
                const visibleViolations = violationsTable.querySelectorAll('tbody tr:not(.hidden)').length;
                banner.querySelector('.violations-count').textContent = \`Filtered Violations: \${visibleViolations}\`;
              }
            });
          }

          document.addEventListener('DOMContentLoaded', () => {
            populateFilters();
            document.querySelectorAll('select').forEach(select => {
              select.addEventListener('change', filterTables);
            });
            
            // Initial filter to set counts
            updateVisibleCounts();
          });
        </script>
      </head>
      <body>
        <div class="container">
          <h1>Multi-Site Accessibility Audit Report</h1>
          <p>Generated on: ${new Date().toISOString()}</p>

          <div class="filters-sticky">
            <div class="filters">
              <div class="filter-group">
                <label for="siteFilter">Site:</label>
                <select id="siteFilter">
                  <option value="all">All Sites</option>
                </select>
              </div>
              <div class="filter-group">
                <label for="browserFilter">Browser:</label>
                <select id="browserFilter">
                  <option value="all">All Browsers</option>
                </select>
              </div>
              <div class="filter-group">
                <label for="pageFilter">Page:</label>
                <select id="pageFilter">
                  <option value="all">All Pages</option>
                </select>
              </div>
              <div class="filter-group">
                <label for="impactFilter">Impact:</label>
                <select id="impactFilter">
                  <option value="all">All Impacts</option>
                </select>
              </div>
              <div class="filter-group">
                <label for="wcagFilter">WCAG:</label>
                <select id="wcagFilter">
                  <option value="all">All WCAG</option>
                </select>
              </div>
            </div>
          </div>
  `;

  for (const [siteName, siteResults] of Object.entries(results)) {
    // Skip sites with no violations
    if (siteResults.violations.length === 0) {
      continue;
    }

    // Get base domain (safely)
    let baseDomain = "unknown";
    try {
      if (siteResults.violations.length > 0) {
        baseDomain = new URL(siteResults.violations[0].pageUrl).hostname;
      }
    } catch (e) {
      console.error("Error parsing URL:", e);
    }

    const totalPages = new Set(siteResults.violations.map((v) => v.pageUrl)).size;

    html += `
        <div class="site-section" data-site="${siteName}">
          <div class="site-banner">
            <h2>${siteName} (${baseDomain})</h2>
            <div class="site-stats">
              <span class="site-stat">Pages Scanned: ${totalPages}</span>
              <span class="site-stat violations-count">Total Violations: ${siteResults.violations.length}</span>
            </div>
          </div>
    `;

    // Generate violations table
    html += `
        <h3>Violations</h3>
        <div class="custom-table-container">
          <table data-site="${siteName}" data-type="violations" class="custom-table">
            <thead>
              <tr>
                <th style="width: 7%;">Browser</th>
                <th style="width: 10%;">Page Name</th>
                <th style="width: 10%;">Path</th>
                <th style="width: 10%;">Rule ID</th>
                <th style="width: 10%;">WCAG</th>
                <th style="width: 5%;">Impact</th>
                <th style="width: 15%;">Description</th>
                <th style="width: 18%;">Elements</th>
                <th style="width: 10%;">Fix Suggestion</th>
                <th style="width: 5%;">Count</th>
              </tr>
            </thead>
            <tbody>
    `;

    siteResults.violations.forEach((violation) => {
      let pathname = "";
      try {
        pathname = new URL(violation.pageUrl).pathname;
      } catch (e) {
        pathname = violation.pageUrl;
      }

      const browser = violation.browser || 'unknown';

      // Clean up fix suggestion
      let fixSuggestion = '';
      if (violation.nodes && violation.nodes.length > 0 && violation.nodes[0].failureSummary) {
        fixSuggestion = violation.nodes[0].failureSummary
          .replace(/Fix any of the following:|Fix all of the following:/, '')
          .trim();

        // Filter out problematic lines
        const lines = fixSuggestion.split('\n').filter(line =>
          !line.includes('Element does not have') &&
          !line.includes('same text as the summary attribute')
        );

        fixSuggestion = lines.join('<br>');
      }

      // Sanitize the description
      let safeDescription = '';
      if (typeof violation.description === 'string') {
        safeDescription = violation.description
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
      }

      html += `
        <tr class="violation">
          <td><span class="browser-tag browser-${browser.toLowerCase()}">${browser}</span></td>
          <td>${violation.pageName}</td>
          <td><a href="${violation.pageUrl}" class="page-link" target="_blank">${pathname}</a></td>
          <td>${violation.id} <a href="https://dequeuniversity.com/rules/axe/4.9/${violation.id
        }?application=playwright" target="_blank" class="learn-more">Learn More</a></td>
          <td>${violation.tags
          .filter((tag) => tag.startsWith('wcag') || tag.startsWith('best-practice'))
          .join(', ')}</td>
          <td class="impact-${violation.impact}">${violation.impact}</td>
          <td>${safeDescription}</td>
          <td>${formatNodes(violation.nodes)}</td>
          <td class="fix-suggestion">${fixSuggestion || 'N/A'}</td>
          <td>${violation.nodes.length}</td>
        </tr>
      `;
    });

    html += `
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  html += `
        </div>
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