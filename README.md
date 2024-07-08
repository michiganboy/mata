# Multi-Site Accessibility Testing Automation (MATA)

This project provides a robust, flexible solution for automating accessibility testing across multiple websites and environments. Built with Playwright and axe-core, it allows developers and QA teams to efficiently conduct comprehensive accessibility audits at scale.

## Key Features:

- **Multi-Site Support**: Test multiple websites with a single command.
- **Environment Flexibility**: Easily switch between QA, staging, and production environments.
- **Customizable Test Paths**: Define test paths for each site using CSV files.
- **Authentication Handling**: Supports both authenticated and non-authenticated sites.
- **Configurable Rulesets**: Use default accessibility rulesets (WCAG 2.1 AA, WCAG 2.2 AA, and best practices) or specify custom ones.
- **Detailed Reporting**: Generates comprehensive HTML reports of accessibility violations.
- **Selective Testing**: Ability to test specific sites, pages, or bypass login for certain sites.

## Use Cases:

- Integrate into CI/CD pipelines for automated accessibility checks.
- Perform regular audits across multiple web properties.
- Quickly assess accessibility compliance for new features or pages.
- Compare accessibility standards across different environments (QA, staging, production).

This tool is designed to streamline the process of ensuring web accessibility compliance, making it easier for teams to build inclusive, accessible web experiences for all users.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Dependencies](#dependencies)
3. [Installation](#installation)
4. [Configuration](#configuration)
   - [Environment Files](#environment-files)
   - [CSV Files](#csv-files)
5. [Usage](#usage)
   - [Running Tests](#running-tests)
   - [Test Results](#test-results)
6. [Adding a New Site](#adding-a-new-site)
7. [Customization](#customization)
8. [Project Structure](#project-structure)

## Prerequisites

- Node.js (v14 or later)
- npm (v6 or later)
- Visual Studio Code
- Playwright Test for VSCode extension

To install the Playwright Test for VSCode extension:
1. Open VSCode
2. Go to the Extensions view (Ctrl+Shift+X)
3. Search for "Playwright Test"
4. Click "Install" on the extension by Microsoft

## Dependencies

This project relies on the following npm packages:

- `@playwright/test`: For browser automation and testing
- `axe-core`: For accessibility testing
- `@axe-core/playwright`: Integration of axe-core with Playwright
- `axe-html-reporter`: For generating HTML reports of accessibility test results
- `csv-parser`: For parsing CSV files
- `dotenv`: For loading environment variables from .env files

## Installation

1. Clone this repository:
   ```
   git clone https://github.com/your-username/accessibility-testing-automation.git
   cd accessibility-testing-automation
   ```

2. Install dependencies:
   ```
   npm install
   ```

## Configuration

### Environment Files

Create separate .env files for each environment in the `env/` directory:
- `env/.env.qa` for QA environment
- `env/.env.staging` for Staging environment
- `env/.env.prod` for Production environment

Each file should have the following structure:

```
SITE_NAMES=Site1,Site2,Site3

SITE1_BASE_URL=https://site1.example.com
SITE1_LOGIN_URL=https://site1.example.com/login
SITE1_PATHS_CSV_FILE=site1_paths.csv
SITE1_USERNAME_SELECTOR=#site1-username
SITE1_PASSWORD_SELECTOR=#site1-password
SITE1_LOGIN_BUTTON_SELECTOR=#site1-login-button
SITE1_USERNAME=site1_user
SITE1_PASSWORD=site1_pass

SITE2_BASE_URL=https://site2.example.com
SITE2_LOGIN_URL=https://site2.example.com/login
SITE2_PATHS_CSV_FILE=site2_paths.csv
SITE2_USERNAME_SELECTOR=#site2-username
SITE2_PASSWORD_SELECTOR=#site2-password
SITE2_LOGIN_BUTTON_SELECTOR=#site2-login-button
SITE2_USERNAME=site2_user
SITE2_PASSWORD=site2_pass

SITE3_BASE_URL=https://site3.example.com
SITE3_PATHS_CSV_FILE=site3_paths.csv
```

Adjust the values for each environment as needed. Note that Site3 is configured without login information, as it doesn't require authentication.

### CSV Files

Create CSV files for each site's paths in the `tests/data/` directory (e.g., `site1_paths.csv`, `site2_paths.csv`, `site3_paths.csv`). Each file should contain a list of pages to test, with their names and paths:

| name      | path    |
|-----------|---------|
| HomePage  | /       |
| AboutPage | /about  |
| ContactPage | /contact |
| ProductsPage | /products |
| BlogPage  | /blog   |

Ensure that the CSV file names in the `tests/data/` directory match those specified in the .env files.

## Usage

### Running Tests

1. Test all sites in the default QA environment:
   ```
   npm run test
   ```

2. Test in a specific environment:
   ```
   npm run test -- --env=staging
   ```
   or
   ```
   npm run test -- --env=prod
   ```

3. Test a specific site in a specific environment:
   ```
   npm run test -- --site=Site1 --env=staging
   ```

4. Bypass login for all sites in a specific environment:
   ```
   npm run test -- --env=prod --bypass-login
   ```

5. Bypass login for specific sites in a specific environment:
   ```
   npm run test -- --env=staging --bypass-login=Site1 --bypass-login=Site2
   ```

6. Test a single page for a specific site:
   ```
   npm run test -- --site=Site1 --env=prod --path=/about
   ```

   This will test only the '/about' page for Site1 in the production environment.

7. Test a single page for a specific site in QA (default environment):
   ```
   npm run test -- --site=Site1 --path=/contact
   ```

   This will test only the '/contact' page for Site1 in the QA environment.

8. Test with specific axe-core rulesets:
   ```
   npm run test -- --rulesets=wcag2a,wcag2aa,section508
   ```

   By default, the tests use the following rulesets:
   - wcag21aa
   - wcag22aa
   - best-practice

   You can override these defaults by using the `--rulesets` flag. Available rulesets include:
   - wcag2a
   - wcag2aa
   - wcag2aaa
   - wcag21a
   - wcag21aa
   - wcag22aa
   - section508
   - best-practice
   - experimental

   You can combine this with other flags:
   ```
   npm run test -- --site=Site1 --env=staging --rulesets=wcag2aa,best-practice
   ```

Notes:
- The `--env` flag specifies the environment to test (qa, staging, or prod). If not specified, it defaults to qa.
- The `--bypass-login` flag without a site name will skip the authentication step for all tested sites. Using `--bypass-login=SiteName` will skip authentication only for the specified site(s).
- The `--path` flag specifies a single page to test. When used, it overrides the paths specified in the CSV files.
- The `--path` flag must be used in conjunction with the `--site` flag. An error will be thrown if `--path` is used without specifying a site.
- The `--rulesets` flag allows you to specify which axe-core rulesets to use for testing. If not specified, the default rulesets (wcag21aa, wcag22aa, and best-practice) will be used.

### Test Results

After running the tests, an HTML report will be generated in the `accessibility-reports` directory. This report contains detailed information about any accessibility issues found during the test.

Example of a generated report:

![Accessibility Test Report Example](images/accessibility-report-example.png)

This report provides an overview of the accessibility issues found, including:

- A summary of total violations, sites tested, and pages tested
- A list of violations, including:
  - The site and page where the violation occurred
  - The specific accessibility rule that was violated
  - The impact level of the violation
  - The HTML element causing the violation
- Detailed descriptions of each violation and suggestions for fixing them

## Adding a New Site

1. Add the new site's configuration to each environment's .env file in the `env/` directory:
   ```
   SITE4_BASE_URL=https://site4.example.com
   SITE4_LOGIN_URL=https://site4.example.com/login
   SITE4_PATHS_CSV_FILE=site4_paths.csv
   SITE4_USERNAME_SELECTOR=#site4-username
   SITE4_PASSWORD_SELECTOR=#site4-password
   SITE4_LOGIN_BUTTON_SELECTOR=#site4-login-button
   SITE4_USERNAME=site4_user
   SITE4_PASSWORD=site4_pass
   ```

2. Update the `SITE_NAMES` variable in each .env file to include the new site:
   ```
   SITE_NAMES=Site1,Site2,Site3,Site4
   ```

3. Create a new CSV file (e.g., `site4_paths.csv`) in the `tests/data/` directory with the paths to test for the new site:

   | name      | path    |
   |-----------|---------|
   | HomePage  | /       |
   | AboutPage | /about  |
   | ContactPage | /contact |

## Customization

- Update the login selectors in the .env files to match each site's login form elements.
- If a selector is not specified in the .env file, the system will use default selectors (#username, #password, #login-button).
- Modify the CSV files to add, remove, or change the pages to be tested for each site.
- To change the default rulesets, modify the `defaultRulesets` array in `tests/fixtures/accessibility.ts`.

## Project Structure

- `tests/`: Contains all test-related files
  - `fixtures/`: Contains all the test fixtures and utility functions
    - `accessibility.ts`: Main accessibility testing logic
    - `authentication.ts`: Handles site authentication
    - `loginSelectors.ts`: Manages login form selectors
    - `reporter.ts`: Generates accessibility reports
    - `siteConfiguration.ts`: Handles site configuration and environment loading
    - `index.ts`: Combines all fixtures
  - `data/`: Contains CSV files with paths to test for each site
    - `site1_paths.csv`, `site2_paths.csv`, `site3_paths.csv`: Path definitions for each site
  - `accessibility.spec.ts`: Main test specification
- `env/`: Contains environment-specific configuration files
  - `.env.qa`, `.env.staging`, `.env.prod`: Environment-specific variables
- `images/`: Contains images used in the README
  - `accessibility-report-example.png`: Example of a generated accessibility report