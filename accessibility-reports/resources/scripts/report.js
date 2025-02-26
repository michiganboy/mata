// Accessibility Report JavaScript
document.addEventListener("DOMContentLoaded", function () {
  // Initialize charts with the data injected into the HTML
  initCharts();

  // Initialize filters
  populateFilters();

  // Set up event listeners
  setupEventListeners();

  // Set the default tab to active
  document.getElementById("defaultTab").click();

  // Initial filter to set counts
  updateVisibleCounts();

  // Resize charts to fit properly
  updateChartSizes();
});

// Function to initialize charts
function initCharts() {
  // Impact Chart
  const impactCtx = document.getElementById("impactChart").getContext("2d");
  new Chart(impactCtx, {
    type: "pie",
    data: {
      labels: ["Critical", "Serious", "Moderate", "Minor"],
      datasets: [
        {
          label: "Violations by Impact",
          data: [
            reportData.summary.criticalViolations,
            reportData.summary.seriousViolations,
            reportData.summary.moderateViolations,
            reportData.summary.minorViolations,
          ],
          backgroundColor: ["#dc3545", "#fd7e14", "#ffc107", "#28a745"],
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: "right",
          labels: {
            boxWidth: 15,
            font: {
              size: 12,
            },
          },
        },
        title: {
          display: true,
          text: "Violations by Impact Level",
          font: {
            size: 16,
            weight: "bold",
          },
        },
      },
    },
  });

  // WCAG Chart - get top 10 WCAG rules for visualization
  const wcagData = reportData.summary.wcagBreakdownArray
    .slice(0, 10)
    .map((item) => ({ label: item[0], value: item[1] }));

  const wcagCtx = document.getElementById("wcagChart").getContext("2d");
  new Chart(wcagCtx, {
    type: "bar",
    data: {
      labels: wcagData.map((item) => item.label),
      datasets: [
        {
          label: "Violations Count",
          data: wcagData.map((item) => item.value),
          backgroundColor: "#3498db",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      indexAxis: "y", // Horizontal bar chart
      plugins: {
        legend: {
          display: false,
        },
        title: {
          display: true,
          text: "Top 10 WCAG Violations",
          font: {
            size: 16,
            weight: "bold",
          },
        },
      },
      scales: {
        y: {
          ticks: {
            font: {
              size: 11,
            },
          },
        },
        x: {
          beginAtZero: true,
          title: {
            display: true,
            text: "Number of Violations",
          },
        },
      },
    },
  });
}

// Function to toggle visibility of elements
function toggleElements(id) {
  const hiddenContent = document.getElementById(id);
  const button = document.querySelector('[aria-controls="' + id + '"]');

  if (hiddenContent.style.display === "block") {
    hiddenContent.style.display = "none";
    button.setAttribute("aria-expanded", "false");
  } else {
    hiddenContent.style.display = "block";
    button.setAttribute("aria-expanded", "true");
  }
}

// Function to export CSV data
function exportViolationsToCSV() {
  window.open("../accessibility-violations.csv", "_blank");
}

function exportToCSV() {
  window.open("../accessibility-summary.csv", "_blank");
}

// Function to update chart sizes
function updateChartSizes() {
  // Resize charts to fit container if necessary
  if (window.Chart && window.Chart.instances) {
    for (const instanceId in window.Chart.instances) {
      if (window.Chart.instances.hasOwnProperty(instanceId)) {
        window.Chart.instances[instanceId].resize();
      }
    }
  }
}

// Function to switch tabs
function switchTab(evt, tabName) {
  // Hide all tab content
  const tabcontent = document.getElementsByClassName("tab-content");
  for (let i = 0; i < tabcontent.length; i++) {
    tabcontent[i].classList.remove("active");
  }

  // Remove active class from all tabs
  const tabs = document.getElementsByClassName("tab");
  for (let i = 0; i < tabs.length; i++) {
    tabs[i].classList.remove("active");
  }

  // Show the specific tab content
  document.getElementById(tabName).classList.add("active");

  // Add active class to the button that opened the tab
  evt.currentTarget.classList.add("active");

  // Update chart sizes when switching tabs
  updateChartSizes();
}

// Function to populate filters
function populateFilters() {
  // Site filter
  const siteFilter = document.getElementById("siteFilter");
  const siteValues = new Set();
  document.querySelectorAll(".site-section").forEach((section) => {
    siteValues.add(section.getAttribute("data-site"));
  });
  siteFilter.innerHTML = '<option value="all">All Sites</option>';
  Array.from(siteValues)
    .sort()
    .forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      siteFilter.appendChild(option);
    });

  // Browser filter (column 0)
  const browserFilter = document.getElementById("browserFilter");
  const browserValues = getUniqueValues("browserFilter", 0);
  browserFilter.innerHTML = '<option value="all">All Browsers</option>';
  browserValues.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    browserFilter.appendChild(option);
  });

  // Page filter (column 1)
  const pageFilter = document.getElementById("pageFilter");
  const pageValues = getUniqueValues("pageFilter", 1);
  pageFilter.innerHTML = '<option value="all">All Pages</option>';
  pageValues.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    pageFilter.appendChild(option);
  });

  // Impact filter (column 5)
  const impactFilter = document.getElementById("impactFilter");
  const impactValues = getUniqueValues("impactFilter", 5);
  impactFilter.innerHTML = '<option value="all">All Impacts</option>';
  impactValues.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    impactFilter.appendChild(option);
  });

  // WCAG filter (column 4)
  const wcagFilter = document.getElementById("wcagFilter");
  const wcagValues = getUniqueValues("wcagFilter", 4);
  wcagFilter.innerHTML = '<option value="all">All WCAG</option>';
  wcagValues.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    wcagFilter.appendChild(option);
  });
}

// Function to set up event listeners
function setupEventListeners() {
  // Set up filter change events
  document.querySelectorAll("select").forEach((select) => {
    select.addEventListener("change", filterTables);
  });

  // Set up export button events
  document
    .getElementById("exportViolationsCSV")
    .addEventListener("click", exportViolationsToCSV);
  document
    .getElementById("exportSummaryCSV")
    .addEventListener("click", exportToCSV);

  // Set up window resize event
  window.addEventListener("resize", updateChartSizes);
}

// Function to get unique values from table cells
function getUniqueValues(selector, column) {
  const values = new Set();
  // Check all tables across all sites for violations
  document
    .querySelectorAll('table[data-type="violations"] tbody tr')
    .forEach((row) => {
      const cell = row.cells[column];
      if (cell && cell.textContent) {
        if (selector === "wcagFilter") {
          const wcagTags = cell.textContent.split(", ");
          wcagTags.forEach((tag) => {
            if (
              tag &&
              (tag.startsWith("wcag") || tag.startsWith("best-practice"))
            ) {
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

// Function to filter tables based on selected filters
function filterTables() {
  const siteFilter = document.getElementById("siteFilter").value;
  const browserFilter = document.getElementById("browserFilter").value;
  const pageFilter = document.getElementById("pageFilter").value;
  const impactFilter = document.getElementById("impactFilter").value;
  const wcagFilter = document.getElementById("wcagFilter").value;

  // First filter site sections
  document.querySelectorAll(".site-section").forEach((section) => {
    const siteName = section.getAttribute("data-site");
    const showSite = siteFilter === "all" || siteFilter === siteName;
    section.classList.toggle("hidden", !showSite);
  });

  // Then filter rows within visible tables
  document
    .querySelectorAll(".site-section:not(.hidden) table")
    .forEach((table) => {
      const rows = table.querySelectorAll("tbody tr");

      rows.forEach((row) => {
        const browser = row.cells[0].textContent.trim();
        const pageName = row.cells[1].textContent.trim();
        const impact = row.cells[5].textContent.trim();
        const wcagTags = row.cells[4].textContent.split(", ");

        const matchesFilters =
          (browserFilter === "all" || browser === browserFilter) &&
          (pageFilter === "all" || pageName === pageFilter) &&
          (impactFilter === "all" || impact === impactFilter) &&
          (wcagFilter === "all" ||
            wcagTags.some((tag) => tag.trim() === wcagFilter));

        row.classList.toggle("hidden", !matchesFilters);
      });
    });

  updateVisibleCounts();
}

// Function to update the visible counts in the UI
function updateVisibleCounts() {
  document.querySelectorAll(".site-section:not(.hidden)").forEach((section) => {
    const banner = section.querySelector(".site-banner");
    const violationsTable = section.querySelector(
      'table[data-type="violations"]'
    );

    if (violationsTable) {
      const visibleViolations = violationsTable.querySelectorAll(
        "tbody tr:not(.hidden)"
      ).length;
      banner.querySelector(".violations-count").textContent =
        "Filtered Violations: " + visibleViolations;
    }
  });
}
