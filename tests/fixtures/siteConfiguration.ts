import dotenv from "dotenv";
import fs from "fs";
import path from "path";

export type Site = {
  name: string;
  baseUrl: string;
  loginUrl?: string;
  pathsCsvFile: string;
  requiresLogin: boolean;
  username?: string;
  password?: string;
};

export function loadEnvironmentConfig(env: string) {
  const envFile = path.join(process.cwd(), "env", `.env.${env.toLowerCase()}`);
  if (!fs.existsSync(envFile)) {
    throw new Error(`Environment file ${envFile} not found`);
  }
  dotenv.config({ path: envFile });
}

export function getSitesConfiguration(targetSite: string | undefined): Site[] {
  const bypassLoginAll = process.env.BYPASS_LOGIN_ALL === 'true';
  const bypassLoginSites = process.env.BYPASS_LOGIN_SITES?.split(',') || [];
  const siteNames = targetSite
    ? [targetSite]
    : process.env.SITE_NAMES?.split(",") || [];

  console.log("Bypass login all:", bypassLoginAll);
  console.log("Bypass login sites:", bypassLoginSites);

  const sites: Site[] = [];

  for (const name of siteNames) {
    const baseUrl = process.env[`${name.toUpperCase()}_BASE_URL`];
    const pathsCsvFile = process.env[`${name.toUpperCase()}_PATHS_CSV_FILE`];

    if (!baseUrl || !pathsCsvFile) {
      throw new Error(`Missing configuration for site ${name}`);
    }

    const fullPathsCsvFile = path.join(
      process.cwd(),
      "tests",
      "data",
      pathsCsvFile
    );

    const bypassLoginForSite = bypassLoginAll || bypassLoginSites.includes(name);
    const loginUrl = process.env[`${name.toUpperCase()}_LOGIN_URL`];
    const requiresLogin = !bypassLoginForSite && !!loginUrl;

    console.log(`Site ${name}:`);
    console.log(`  Bypass login: ${bypassLoginForSite}`);
    console.log(`  Requires login: ${requiresLogin}`);

    const site: Site = {
      name,
      baseUrl,
      pathsCsvFile: fullPathsCsvFile,
      requiresLogin,
      loginUrl,
    };

    if (requiresLogin) {
      const username = process.env[`${name.toUpperCase()}_USERNAME`];
      const password = process.env[`${name.toUpperCase()}_PASSWORD`];

      if (!username || !password) {
        console.warn(`Warning: Missing login configuration for site ${name}, but login is required.`);
      }

      site.username = username;
      site.password = password;
    }

    sites.push(site);
  }

  if (sites.length === 0) {
    throw new Error("No sites configured or target site not found");
  }

  console.log("Sites configuration:", JSON.stringify(sites, null, 2));

  return sites;
}