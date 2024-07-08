import '@playwright/test';

declare module '@playwright/test' {
  interface PlaywrightTestOptions {
    site?: string;
    bypassLoginAll?: boolean;
    bypassLoginSites?: string[];
    path?: string;
    rulesets?: string;
  }
}