import { AxeResults } from 'axe-core';
import { createHtmlReport } from 'axe-html-reporter';
import fs from 'fs';
import path from 'path';

export interface EnhancedAxeResults extends AxeResults {
  pageName: string;
  siteName: string;
}

export function generateAccessibilityReport(allResults: EnhancedAxeResults[]): number {
  // Consolidate all results into a single AxeResults object
  const consolidatedResult: Partial<AxeResults> = {
    passes: [],
    violations: [],
    incomplete: [],
    inapplicable: [],
    timestamp: new Date().toISOString(),
    url: 'Multi-page report'
  };

  allResults.forEach(result => {
    consolidatedResult.passes = [...(consolidatedResult.passes || []), ...(result.passes || [])];
    consolidatedResult.violations = [...(consolidatedResult.violations || []), ...(result.violations || [])];
    consolidatedResult.incomplete = [...(consolidatedResult.incomplete || []), ...(result.incomplete || [])];
    consolidatedResult.inapplicable = [...(consolidatedResult.inapplicable || []), ...(result.inapplicable || [])];
  });

  const reportHTML = createHtmlReport({
    results: consolidatedResult,
    options: {
      projectKey: 'Multi-Site Accessibility Audit',
    },
  });

  const reportsDir = path.join(process.cwd(), 'accessibility-reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir);
  }

  const reportPath = path.join(reportsDir, 'consolidated-multi-site-accessibility-report.html');
  fs.writeFileSync(reportPath, reportHTML);

  console.log(`Consolidated report saved at ${reportPath}`);

  const totalViolations = consolidatedResult.violations?.length || 0;
  if (totalViolations > 0) {
    console.warn(`Total accessibility violations found: ${totalViolations}. Check the consolidated report for details.`);
  }

  return totalViolations;
}