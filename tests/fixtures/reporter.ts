import { AxeResults, Result, NodeResult } from "axe-core";
import fs from "fs";
import path from "path";
import ejs from "ejs";

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
  browsers: string[]; // List of browsers that found this violation
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
    browserViolationCounts?: Record<string, number>;
  };
  generatedAt: string;
}

// Main reporting function
export function generateAccessibilityReport(
  results: EnhancedAxeResults[],
  browserName: string
): number {
  // Create directory for results if it doesn't exist
  const reportsDir = path.join(process.cwd(), "accessibility-reports");
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const resultsDir = path.join(reportsDir, "browser-results");
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const dataDir = path.join(reportsDir, "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Tag each result with browser info
  const taggedResults = results.map((result) => ({
    ...result,
    browser: browserName,
  }));

  // Save this browser's results to disk
  const browserResultsFile = path.join(
    resultsDir,
    `${browserName}-results.json`
  );
  fs.writeFileSync(browserResultsFile, JSON.stringify(taggedResults, null, 2));

  // Read all browser result files
  const allResults: EnhancedAxeResults[] = [];
  const browserFiles = fs
    .readdirSync(resultsDir)
    .filter((file) => file.endsWith("-results.json"));

  for (const file of browserFiles) {
    try {
      const fileContent = fs.readFileSync(path.join(resultsDir, file), "utf8");
      const fileResults = JSON.parse(fileContent) as EnhancedAxeResults[];
      const fileBrowser = file.replace("-results.json", "");

      allResults.push(...fileResults);
    } catch (error) {
      console.error(`Error processing browser file ${file}:`, error);
    }
  }

  // Generate the combined report
  return generateCombinedReport(allResults, reportsDir, dataDir);
}

// Function to render the EJS template
function renderEjsReport(reportData: ReportData, outputPath: string): void {
  try {
    // Path to the main EJS template
    const templatePath = path.join(
      process.cwd(),
      "accessibility-reports",
      "templates",
      "report.ejs"
    );

    // Check if template exists
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template file not found: ${templatePath}`);
    }

    // Render the EJS template with the provided data
    ejs.renderFile(
      templatePath,
      {
        reportData,
        results: reportData.results,
      },
      (err, html) => {
        if (err) {
          console.error("Error rendering EJS template:", err);
          return;
        }

        // Fix resource paths in the rendered HTML
        let fixedHtml = html;

        // Update resource paths for the root location
        fixedHtml = fixedHtml.replace(
          /<link rel="stylesheet" href="\.\.\/resources\/styles\/report.css">/g,
          '<link rel="stylesheet" href="resources/styles/report.css">'
        );

        fixedHtml = fixedHtml.replace(
          /<script src="\.\.\/resources\/scripts\/report.js"><\/script>/g,
          '<script src="resources/scripts/report.js"></script>'
        );

        // Write the rendered HTML to the output file
        fs.writeFileSync(outputPath, fixedHtml);
      }
    );
  } catch (error) {
    console.error("Error generating HTML report:", error);
  }
}

// Function to combine results from all broswers
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
    browsers: new Set<string>(),
  };

  // Map to track unique violations and the browsers they were found in
  const violationMap = new Map<
    string,
    {
      violation: EnhancedResultItem;
      browsers: Set<string>;
    }
  >();

  // Browser violation counts
  const browserViolationCounts: Record<string, number> = {};

  // First pass: Collect all violations and their browser info
  for (const result of allResults) {
    // Initialize browser counts if needed
    if (result.browser && !browserViolationCounts[result.browser]) {
      browserViolationCounts[result.browser] = 0;
    }

    // Initialize site if needed
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
          browsers: new Set<string>(),
        },
      };
    }

    // Update browser information
    if (result.browser) {
      consolidatedResult[result.siteName].summary.browsers.add(result.browser);
      globalSummary.browsers.add(result.browser);
    }

    // Update page information
    consolidatedResult[result.siteName].summary.uniquePages.add(result.url);
    globalSummary.uniquePages.add(result.url);

    // Process violations
    if (Array.isArray(result.violations)) {
      // Count violations per browser
      if (result.browser) {
        browserViolationCounts[result.browser] += result.violations.length;
      }

      // Process each violation
      result.violations.forEach((item) => {
        // Create a unique key for this violation
        const violationKey = `${result.siteName}_${item.id}_${
          result.url
        }_${item.nodes.map((n) => n.target.join(",")).join("|")}`;

        // Check if we've seen this violation before
        if (!violationMap.has(violationKey)) {
          // First time seeing this violation
          const enhancedItem: EnhancedResultItem = {
            ...item,
            siteName: result.siteName,
            pageName: result.pageName,
            pageUrl: result.url,
            browsers: result.browser ? [result.browser] : [],
            formattedNodes: formatNodes(item.nodes),
            formattedFixSuggestion: formatFixSuggestion(item.nodes),
          };

          violationMap.set(violationKey, {
            violation: enhancedItem,
            browsers: new Set(result.browser ? [result.browser] : []),
          });
        } else {
          // We've seen this violation before, add this browser to the set
          if (result.browser) {
            violationMap.get(violationKey)!.browsers.add(result.browser);
          }
        }
      });
    }
  }

  // Second pass: Build the consolidated results from the unique violations
  for (const [siteName, siteResult] of Object.entries(consolidatedResult)) {
    // Get all violations for this site
    const siteViolations: Array<{
      key: string;
      data: { violation: EnhancedResultItem; browsers: Set<string> };
    }> = [];

    for (const [key, data] of violationMap.entries()) {
      if (data.violation.siteName === siteName) {
        siteViolations.push({ key, data });
      }
    }

    // Update the violations array with merged browser information
    for (const { data } of siteViolations) {
      // Create the final violation with all browsers
      const finalViolation: EnhancedResultItem = {
        ...data.violation,
        browsers: Array.from(data.browsers).sort(), // Sort browsers alphabetically for consistent display
      };

      // Add to site violations
      siteResult.violations.push(finalViolation);

      // Update rule count for site
      siteResult.summary.uniqueRules.add(finalViolation.id);
      globalSummary.uniqueRules.add(finalViolation.id);

      // Update impact counts for site
      siteResult.summary.totalViolations++;

      if (finalViolation.impact === "critical") {
        siteResult.summary.criticalViolations++;
      } else if (finalViolation.impact === "serious") {
        siteResult.summary.seriousViolations++;
      } else if (finalViolation.impact === "moderate") {
        siteResult.summary.moderateViolations++;
      } else if (finalViolation.impact === "minor") {
        siteResult.summary.minorViolations++;
      }

      // Update WCAG breakdown for site
      if (Array.isArray(finalViolation.tags)) {
        finalViolation.tags
          .filter(
            (tag) => tag.startsWith("wcag") || tag.startsWith("best-practice")
          )
          .forEach((wcagTag) => {
            const currentCount =
              siteResult.summary.wcagBreakdown.get(wcagTag) || 0;
            siteResult.summary.wcagBreakdown.set(wcagTag, currentCount + 1);
          });
      }
    }
  }

  // Update global summary counts
  globalSummary.totalViolations = Object.values(consolidatedResult).reduce(
    (sum, site) => sum + site.summary.totalViolations,
    0
  );

  globalSummary.criticalViolations = Object.values(consolidatedResult).reduce(
    (sum, site) => sum + site.summary.criticalViolations,
    0
  );

  globalSummary.seriousViolations = Object.values(consolidatedResult).reduce(
    (sum, site) => sum + site.summary.seriousViolations,
    0
  );

  globalSummary.moderateViolations = Object.values(consolidatedResult).reduce(
    (sum, site) => sum + site.summary.moderateViolations,
    0
  );

  globalSummary.minorViolations = Object.values(consolidatedResult).reduce(
    (sum, site) => sum + site.summary.minorViolations,
    0
  );

  // Compile global WCAG breakdown
  for (const site of Object.values(consolidatedResult)) {
    site.summary.wcagBreakdown.forEach((count, tag) => {
      const currentCount = globalSummary.wcagBreakdown.get(tag) || 0;
      globalSummary.wcagBreakdown.set(tag, currentCount + count);
    });
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
      wcagBreakdownArray: Array.from(
        globalSummary.wcagBreakdown.entries()
      ).sort((a, b) => b[1] - a[1]),
      browsersArray: Array.from(globalSummary.browsers),
      browserViolationCounts,
    },
    generatedAt: new Date().toISOString(),
  };

  // Save data as JSON
  const dataFile = path.join(dataDir, "report-data.json");
  fs.writeFileSync(dataFile, JSON.stringify(reportData, null, 2));

  // Generate HTML report using EJS
  const reportPath = path.join(reportsDir, "report.html");
  renderEjsReport(reportData, reportPath);

  // Generate CSV reports
  const summaryCSVPath = path.join(reportsDir, "accessibility-summary.csv");
  generateSummaryCSV(consolidatedResult, globalSummary, summaryCSVPath);

  const violationsCSVPath = path.join(
    reportsDir,
    "accessibility-violations.csv"
  );
  generateViolationsCSV(consolidatedResult, violationsCSVPath);

  return globalSummary.totalViolations;
}

// Function to format nodes with expandable view
function formatNodes(nodes: NodeResult[]): string {
  if (nodes.length <= 3) {
    // If 3 or fewer elements, just show them all
    return nodes
      .map((node) => {
        const safeTarget = node.target
          .map((part) =>
            String(part).replace(/</g, "&lt;").replace(/>/g, "&gt;")
          )
          .join(" ");

        return `<span class="element" title="${safeTarget}">${safeTarget}</span>`;
      })
      .join("");
  } else {
    // For more than 3 elements, show first 3 with expand capability
    const visibleElements = nodes
      .slice(0, 3)
      .map((node) => {
        const safeTarget = node.target
          .map((part) =>
            String(part).replace(/</g, "&lt;").replace(/>/g, "&gt;")
          )
          .join(" ");

        return `<span class="element" title="${safeTarget}">${safeTarget}</span>`;
      })
      .join("");

    // Generate the hidden elements (all elements for completeness)
    const allElements = nodes
      .map((node) => {
        const safeTarget = node.target
          .map((part) =>
            String(part).replace(/</g, "&lt;").replace(/>/g, "&gt;")
          )
          .join(" ");

        return `<span class="element" title="${safeTarget}">${safeTarget}</span>`;
      })
      .join("");

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
    return "N/A";
  }

  const fixSuggestion = nodes[0].failureSummary
    .replace(/Fix any of the following:|Fix all of the following:/, "")
    .trim();

  // Filter out problematic lines
  const lines = fixSuggestion
    .split("\n")
    .filter(
      (line) =>
        !line.includes("Element does not have") &&
        !line.includes("same text as the summary attribute")
    );

  return lines.join("<br>");
}

// Function to generate summary CSV
function generateSummaryCSV(
  results: SiteResultSummary,
  globalSummary: ResultSummary,
  outputPath: string
): void {
  let csv =
    "Site,Total Pages,Total Violations,Critical,Serious,Moderate,Minor,Unique Rules,Browsers\n";

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
    csv += `"${Array.from(siteResult.summary.browsers).join(", ")}"\n`;
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
  csv += `"${Array.from(globalSummary.browsers).join(", ")}"\n`;

  fs.writeFileSync(outputPath, csv);
}

// Function to generate violations CSV
function generateViolationsCSV(
  results: SiteResultSummary,
  outputPath: string
): void {
  // Create CSV header
  let csv =
    "Site,Page,URL,Browser,Rule ID,Impact,WCAG Tags,Description,Elements,Fix Suggestion\n";

  // Add each violation as a row
  for (const [siteName, siteResult] of Object.entries(results)) {
    for (const violation of siteResult.violations) {
      // Basic fields
      csv += `"${siteName}",`;
      csv += `"${violation.pageName.replace(/"/g, '""')}",`;
      csv += `"${violation.pageUrl.replace(/"/g, '""')}",`;
      csv += `"${
        violation.browsers.length > 0
          ? violation.browsers.join(", ")
          : "unknown"
      }",`;
      csv += `"${violation.id}",`;
      csv += `"${violation.impact}",`;

      // WCAG tags
      const wcagTags = violation.tags
        .filter(
          (tag) => tag.startsWith("wcag") || tag.startsWith("best-practice")
        )
        .join(", ");
      csv += `"${wcagTags}",`;

      // Description - clean quotes
      const safeDescription = violation.description
        ? violation.description.replace(/"/g, '""')
        : "";
      csv += `"${safeDescription}",`;

      // Elements - limit to first 10 for readability
      const elementTexts = violation.nodes
        .slice(0, 10)
        .map((node) => node.target.join(" ").replace(/"/g, '""'));
      let elementText = elementTexts.join(" | ");
      if (violation.nodes.length > 10) {
        elementText += ` ... (${violation.nodes.length - 10} more)`;
      }
      csv += `"${elementText}",`;

      // Fix suggestion - clean quotes and newlines
      let fixSuggestion = "";
      if (
        violation.nodes &&
        violation.nodes.length > 0 &&
        violation.nodes[0].failureSummary
      ) {
        fixSuggestion = violation.nodes[0].failureSummary
          .replace(/Fix any of the following:|Fix all of the following:/, "")
          .trim()
          .replace(/\n/g, " ")
          .replace(/"/g, '""');
      }
      csv += `"${fixSuggestion}"\n`;
    }
  }

  fs.writeFileSync(outputPath, csv);
}
