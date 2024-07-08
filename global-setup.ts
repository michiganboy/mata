import { FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('Global setup config:');
  console.log('site:', config.projects[0].use.site);
  console.log('bypassLoginAll:', config.projects[0].use.bypassLoginAll);
  console.log('bypassLoginSites:', config.projects[0].use.bypassLoginSites);
  console.log('path:', config.projects[0].use.path);
  console.log('rulesets:', config.projects[0].use.rulesets);

  if (config.projects[0].use.site) process.env.SITE = config.projects[0].use.site as string;
  if (config.projects[0].use.bypassLoginAll !== undefined) process.env.BYPASS_LOGIN_ALL = String(config.projects[0].use.bypassLoginAll);
  if (config.projects[0].use.bypassLoginSites) process.env.BYPASS_LOGIN_SITES = (config.projects[0].use.bypassLoginSites as string[]).join(',');
  if (config.projects[0].use.path) process.env.PATH = config.projects[0].use.path as string;
  if (config.projects[0].use.rulesets) process.env.RULESETS = config.projects[0].use.rulesets as string;
}

export default globalSetup;