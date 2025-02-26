import { AxeResults, Result, NodeResult } from 'axe-core';
import fs from 'fs';
import path from 'path';
import ejs from 'ejs';

// Type definitions
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
  formattedNodes?: string;
  formattedFixSuggestion?: string;
}

interface ResultSummary {
  totalViolations: number;
  criticalViolations: number;
  seriousViolations: number;
  moderateViolations: number;
  minorViolations: number;
  uniqueRules: Set<string>;
  uniquePages: Set<string>;
  wcagBreakdown: Map<string, number>;
  browsers: Set<string>;
}

interface SiteResultSummary {
  [siteName: string]: {
    violations: EnhancedResultItem[];
    summary: ResultSummary;
  };
}

interface ReportData {
  results: SiteResultSummary;
  summary: {
    totalViolations: number;
    criticalViolations: number;
    seriousViolations: number;
    moderateViolations: number;
    minorViolations: number;
    uniqueRulesCount: number;
    uniqueRules: string[];
    uniquePagesCount: number;
    uniquePages: string[];
    wcagBreakdownArray: [string, number][];
    browsersArray: string[];
  };
  generatedAt: string;
}

// Main reporting function
export function generateAccessibilityReport(
  results: EnhancedAxeResults[],
  browserName: string
): number {
  console.log(`\n=== BROWSER ${browserName} REPORTING ${results.length} RESULTS ===`);

  // Create directory for results if it doesn't exist
  const reportsDir = path.join(process.cwd(), 'accessibility-reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const resultsDir = path.join(reportsDir, 'browser-results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const dataDir = path.join(reportsDir, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
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
  return generateCombinedReport(allResults, reportsDir, dataDir);
}

function generateCombinedReport(
  allResults: EnhancedAxeResults[],
  reportsDir: string,
  dataDir: string
): number {
  const consolidatedResult: SiteResultSummary = {};
  const globalSummary: ResultSummary = {
    totalViolations: 0,
    criticalViolations: 0,
    seriousViolations: 0,
    moderateViolations: 0,
    minorViolations: 0,
    uniqueRules: new Set<string>(),
    uniquePages: new Set<string>(),
    wcagBreakdown: new Map<string, number>(),
    browsers: new Set<string>()
  };

  // Process all results and build consolidated result
  for (const result of allResults) {
    if (!consolidatedResult[result.siteName]) {
      consolidatedResult[result.siteName] = {
        violations: [],
        summary: {
          totalViolations: 0,
          criticalViolations: 0,
          seriousViolations: 0,
          moderateViolations: 0,
          minorViolations: 0,
          uniqueRules: new Set<string>(),
          uniquePages: new Set<string>(),
          wcagBreakdown: new Map<string, number>(),
          browsers: new Set<string>()
        }
      };
    }

    const siteResult = consolidatedResult[result.siteName];
    const siteSummary = siteResult.summary;

    // Update site level browser information
    if (result.browser) {
      siteSummary.browsers.add(result.browser);
      globalSummary.browsers.add(result.browser);
    }

    // Update site level page information
    siteSummary.uniquePages.add(result.url);
    globalSummary.uniquePages.add(result.url);

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
          const enhancedItem: EnhancedResultItem = {
            ...item,
            siteName: result.siteName,
            pageName: result.pageName,
            pageUrl: result.url,
            browser: result.browser,
            formattedNodes: formatNodes(item.nodes),
            formattedFixSuggestion: formatFixSuggestion(item.nodes)
          };
          
          siteResult.violations.push(enhancedItem);
          
          // Update rule count
          siteSummary.uniqueRules.add(item.id);
          globalSummary.uniqueRules.add(item.id);
          
          // Update impact counts
          siteSummary.totalViolations++;
          globalSummary.totalViolations++;
          
          if (item.impact === 'critical') {
            siteSummary.criticalViolations++;
            globalSummary.criticalViolations++;
          } else if (item.impact === 'serious') {
            siteSummary.seriousViolations++;
            globalSummary.seriousViolations++;
          } else if (item.impact === 'moderate') {
            siteSummary.moderateViolations++;
            globalSummary.moderateViolations++;
          } else if (item.impact === 'minor') {
            siteSummary.minorViolations++;
            globalSummary.minorViolations++;
          }
          
          // Update WCAG breakdown
          if (Array.isArray(item.tags)) {
            item.tags
              .filter(tag => tag.startsWith('wcag') || tag.startsWith('best-practice'))
              .forEach(wcagTag => {
                siteSummary.wcagBreakdown.set(
                  wcagTag,
                  (siteSummary.wcagBreakdown.get(wcagTag) || 0) + 1
                );
                globalSummary.wcagBreakdown.set(
                  wcagTag,
                  (globalSummary.wcagBreakdown.get(wcagTag) || 0) + 1
                );
              });
          }
        }
      });
    }
  }

  // Prepare data for templates
  const reportData: ReportData = {
    results: consolidatedResult,
    summary: {
      totalViolations: globalSummary.totalViolations,
      criticalViolations: globalSummary.criticalViolations,
      seriousViolations: globalSummary.seriousViolations,
      moderateViolations: globalSummary.moderateViolations,
      minorViolations: globalSummary.minorViolations,
      uniqueRulesCount: globalSummary.uniqueRules.size,
      uniqueRules: Array.from(globalSummary.uniqueRules),
      uniquePagesCount: globalSummary.uniquePages.size,
      uniquePages: Array.from(globalSummary.uniquePages),
      wcagBreakdownArray: Array.from(globalSummary.wcagBreakdown.entries())
        .sort((a, b) => b[1] - a[1]),
      browsersArray: Array.from(globalSummary.browsers)
    },
    generatedAt: new Date().toISOString()
  };

  // Save data as JSON
  const dataFile = path.join(dataDir, 'report-data.json');
  fs.writeFileSync(dataFile, JSON.stringify(reportData, null, 2));

  // Generate HTML report using EJS
  const templatePath = path.join(process.cwd(), 'accessibility-reports', 'templates', 'report.ejs');
  
  try {
    const html = ejs.renderFile(templatePath, { 
      reportData,
      results: consolidatedResult
    }).then(content => {
      // Write HTML report
      const reportPath = path.join(reportsDir, 'consolidated-multi-browser-accessibility-report.html');
      fs.writeFileSync(reportPath, content);
    }).catch(err => {
      console.error('Error rendering EJS template:', err);
    });
  } catch (err) {
    console.error('Error rendering report:', err);
  }

  // Generate CSV reports
  const summaryCSVPath = path.join(reportsDir, 'accessibility-summary.csv');
  generateSummaryCSV(consolidatedResult, globalSummary, summaryCSVPath);

  const violationsCSVPath = path.join(reportsDir, 'accessibility-violations.csv');
  generateViolationsCSV(consolidatedResult, violationsCSVPath);

  return globalSummary.totalViolations;
}

// Function to format nodes with expandable view
function formatNodes(nodes: NodeResult[]): string {
  if (nodes.length <= 3) {
    // If 3 or fewer elements, just show them all
    return nodes
      .map(node => {
        const safeTarget = node.target
          .map(part => String(part).replace(/</g, '&lt;').replace(/>/g, '&gt;'))
          .join(' ');
        
        return `<span class="element" title="${safeTarget}">${safeTarget}</span>`;
      })
      .join('');
  } else {
    // For more than 3 elements, show first 3 with expand capability
    const visibleElements = nodes.slice(0, 3).map(node => {
      const safeTarget = node.target
        .map(part => String(part).replace(/</g, '&lt;').replace(/>/g, '&gt;'))
        .join(' ');
      
      return `<span class="element" title="${safeTarget}">${safeTarget}</span>`;
    }).join('');
    
    // Generate the hidden elements (all elements for completeness)
    const allElements = nodes.map(node => {
      const safeTarget = node.target
        .map(part => String(part).replace(/</g, '&lt;').replace(/>/g, '&gt;'))
        .join(' ');
      
      return `<span class="element" title="${safeTarget}">${safeTarget}</span>`;
    }).join('');
    
    // Create unique ID for this node group
    const uniqueId = `elements-${Math.random().toString(36).substring(2, 11)}`;
    
    return `
      <div class="element-container">
        <div class="element-visible">
          ${visibleElements}
          <button class="element-expand-btn" onclick="toggleElements('${uniqueId}')" aria-expanded="false" aria-controls="${uniqueId}">
            +${nodes.length - 3} more elements
          </button>
        </div>
        <div id="${uniqueId}" class="element-hidden">
          ${allElements}
          <button class="element-collapse-btn" onclick="toggleElements('${uniqueId}')" aria-expanded="true">
            Show less
          </button>
        </div>
      </div>
    `;
  }
}

// Function to format fix suggestion
function formatFixSuggestion(nodes: NodeResult[]): string {
  if (!nodes || nodes.length === 0 || !nodes[0].failureSummary) {
    return 'N/A';
  }
  
  const fixSuggestion = nodes[0].failureSummary
    .replace(/Fix any of the following:|Fix all of the following:/, '')
    .trim();

  // Filter out problematic lines
  const lines = fixSuggestion.split('\n').filter(line =>
    !line.includes('Element does not have') &&
    !line.includes('same text as the summary attribute')
  );

  return lines.join('<br>');
}

// Function to generate summary CSV
function generateSummaryCSV(
  results: SiteResultSummary, 
  globalSummary: ResultSummary,
  outputPath: string
): void {
  let csv = 'Site,Total Pages,Total Violations,Critical,Serious,Moderate,Minor,Unique Rules,Browsers\n';
  
  // Add row for each site
  for (const [siteName, siteResult] of Object.entries(results)) {
    csv += `${siteName},`;
    csv += `${siteResult.summary.uniquePages.size},`;
    csv += `${siteResult.summary.totalViolations},`;
    csv += `${siteResult.summary.criticalViolations},`;
    csv += `${siteResult.summary.seriousViolations},`;
    csv += `${siteResult.summary.moderateViolations},`;
    csv += `${siteResult.summary.minorViolations},`;
    csv += `${siteResult.summary.uniqueRules.size},`;
    csv += `"${Array.from(siteResult.summary.browsers).join(', ')}"\n`;
  }
  
  // Add global summary row
  csv += `TOTALS,`;
  csv += `${globalSummary.uniquePages.size},`;
  csv += `${globalSummary.totalViolations},`;
  csv += `${globalSummary.criticalViolations},`;
  csv += `${globalSummary.seriousViolations},`;
  csv += `${globalSummary.moderateViolations},`;
  csv += `${globalSummary.minorViolations},`;
  csv += `${globalSummary.uniqueRules.size},`;
  csv += `"${Array.from(globalSummary.browsers).join(', ')}"\n`;
  
  fs.writeFileSync(outputPath, csv);
}

// Function to generate violations CSV
function generateViolationsCSV(
  results: SiteResultSummary,
  outputPath: string
): void {
  // Create CSV header
  let csv = 'Site,Page,URL,Browser,Rule ID,Impact,WCAG Tags,Description,Elements,Fix Suggestion\n';
  
  // Add each violation as a row
  for (const [siteName, siteResult] of Object.entries(results)) {
    for (const violation of siteResult.violations) {
      // Basic fields
      csv += `"${siteName}",`;
      csv += `"${violation.pageName.replace(/"/g, '""')}",`;
      csv += `"${violation.pageUrl.replace(/"/g, '""')}",`;
      csv += `"${violation.browser || 'unknown'}",`;
      csv += `"${violation.id}",`;
      csv += `"${violation.impact}",`;
      
      // WCAG tags
      const wcagTags = violation.tags
        .filter(tag => tag.startsWith('wcag') || tag.startsWith('best-practice'))
        .join(', ');
      csv += `"${wcagTags}",`;
      
      // Description - clean quotes
      const safeDescription = violation.description ? 
        violation.description.replace(/"/g, '""') : '';
      csv += `"${safeDescription}",`;
      
      // Elements - limit to first 10 for readability
      const elementTexts = violation.nodes.slice(0, 10).map(node => 
        node.target.join(' ').replace(/"/g, '""')
      );
      let elementText = elementTexts.join(' | ');
      if (violation.nodes.length > 10) {
        elementText += ` ... (${violation.nodes.length - 10} more)`;
      }
      csv += `"${elementText}",`;
      
      // Fix suggestion - clean quotes and newlines
      let fixSuggestion = '';
      if (violation.nodes && violation.nodes.length > 0 && violation.nodes[0].failureSummary) {
        fixSuggestion = violation.nodes[0].failureSummary
          .replace(/Fix any of the following:|Fix all of the following:/, '')
          .trim()
          .replace(/\n/g, ' ')
          .replace(/"/g, '""');
      }
      csv += `"${fixSuggestion}"\n`;
    }
  }
  
  fs.writeFileSync(outputPath, csv);
}