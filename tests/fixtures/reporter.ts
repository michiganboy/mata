import { AxeResults, Result, NodeResult } from 'axe-core';
import fs from 'fs';
import path from 'path';

export interface EnhancedAxeResults extends AxeResults {
  pageName: string;
  siteName: string;
  url: string;
}

interface EnhancedResultItem extends Result {
  siteName: string;
  pageName: string;
  pageUrl: string;
}

type EnhancedResults = {
  passes: EnhancedResultItem[];
  violations: EnhancedResultItem[];
  incomplete: EnhancedResultItem[];
  inapplicable: EnhancedResultItem[];
}

export function generateAccessibilityReport(allResults: EnhancedAxeResults[]): number {
  const consolidatedResult: { [siteName: string]: EnhancedResults } = {};

  allResults.forEach(result => {
    if (!consolidatedResult[result.siteName]) {
      consolidatedResult[result.siteName] = {
        passes: [],
        violations: [],
        incomplete: [],
        inapplicable: [],
      };
    }

    const siteResult = consolidatedResult[result.siteName];
    
    ['passes', 'violations', 'incomplete', 'inapplicable'].forEach((resultType) => {
      (result[resultType as keyof AxeResults] as Result[]).forEach(item => {
        siteResult[resultType as keyof EnhancedResults].push({
          ...item,
          siteName: result.siteName,
          pageName: result.pageName,
          pageUrl: result.url,
        });
      });
    });
  });

  const customReportHTML = generateCustomReport(consolidatedResult);

  const reportsDir = path.join(process.cwd(), 'accessibility-reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir);
  }

  const reportPath = path.join(reportsDir, 'consolidated-multi-site-accessibility-report.html');
  fs.writeFileSync(reportPath, customReportHTML);

  console.log(`Consolidated report saved at ${reportPath}`);

  const totalViolations = Object.values(consolidatedResult).reduce((sum, result) => 
    sum + result.violations.reduce((siteSum, violation) => siteSum + violation.nodes.length, 0), 0
  );
  console.log(`Total violations calculated in reporter: ${totalViolations}`);

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
          .site-banner { background-color: #3498db; color: white; padding: 20px; margin-bottom: 20px; border-radius: 5px; }
          .site-banner h2 { margin: 0; }
          .site-stats { display: flex; justify-content: space-between; margin-top: 10px; }
          .site-stat { background-color: rgba(255,255,255,0.2); padding: 10px; border-radius: 5px; }
          table { border-collapse: collapse; width: 100%; margin-bottom: 20px; table-layout: fixed; }
          th, td { border: 1px solid #666; padding: 12px; text-align: left; word-wrap: break-word; }
          th { background-color: #f2f2f2; }
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
        </style>
      </head>
      <body>
        <h1>Multi-Site Accessibility Audit Report</h1>
        <p>Generated on: ${new Date().toISOString()}</p>
  `;

  let grandTotalViolations = 0;

  for (const [siteName, siteResults] of Object.entries(results)) {
    const baseDomain = new URL(siteResults.violations[0]?.pageUrl || '').hostname;
    const totalPages = new Set([
      ...siteResults.violations.map(v => v.pageUrl),
      ...siteResults.passes.map(p => p.pageUrl)
    ]).size;
    const totalViolations = siteResults.violations.reduce((sum, violation) => sum + violation.nodes.length, 0);
    grandTotalViolations += totalViolations;
    const totalPasses = siteResults.passes.length;

    html += `
        <div class="site-banner">
          <h2>${siteName} (${baseDomain})</h2>
          <div class="site-stats">
            <span class="site-stat">Pages Scanned: ${totalPages}</span>
            <span class="site-stat">Total Violations: ${totalViolations}</span>
            <span class="site-stat">Total Passes: ${totalPasses}</span>
          </div>
        </div>
        <h3>Violations</h3>
        <table>
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

    siteResults.violations.forEach(violation => {
      const parsedUrl = new URL(violation.pageUrl);
      html += `
        <tr class="violation">
          <td>${violation.pageName}</td>
          <td>${parsedUrl.pathname}</td>
          <td>${violation.id} <a href="https://dequeuniversity.com/rules/axe/4.9/${violation.id}?application=playwright" target="_blank" class="learn-more">Learn More</a></td>
          <td>${violation.tags.filter(tag => tag.startsWith('wcag') || tag.startsWith('best-practice')).join(', ')}</td>
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
        <table>
          <tr>
            <th style="width: 20%;">Page Name</th>
            <th style="width: 20%;">Path</th>
            <th style="width: 20%;">Rule ID</th>
            <th style="width: 40%;">Description</th>
          </tr>
    `;

    siteResults.passes.forEach(pass => {
      const parsedUrl = new URL(pass.pageUrl);
      html += `
        <tr class="pass">
          <td>${pass.pageName}</td>
          <td>${parsedUrl.pathname}</td>
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
        <h2>Grand Total Violations: ${grandTotalViolations}</h2>
      </body>
    </html>
  `;

  return html;
}

function formatNodes(nodes: NodeResult[]): string {
  return nodes.map(node => `<span class="element">${node.target.join(' ')}</span>`).join('');
}