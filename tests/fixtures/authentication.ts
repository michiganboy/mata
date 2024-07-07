import { Fixtures, Page } from '@playwright/test';
import { LoginSelectorsFixture } from './loginSelectors';

export type AuthenticationFixture = {
  authenticate: (siteName: string, loginUrl: string, username: string, password: string) => Promise<void>;
};

type AuthenticationDeps = LoginSelectorsFixture & {
  page: Page;
};

export const authenticationFixture: Fixtures<AuthenticationFixture, AuthenticationDeps> = {
  authenticate: async ({ page, getLoginSelectors }, use) => {
    const authenticateFunc = async (siteName: string, loginUrl: string, username: string, password: string) => {
      const selectors = getLoginSelectors(siteName);
      await page.goto(loginUrl);
      await page.fill(selectors.usernameInput, username);
      await page.fill(selectors.passwordInput, password);
      await page.click(selectors.loginButton);
      await page.waitForLoadState()
      console.log(`Authentication completed for ${siteName} at ${loginUrl}`);
    };

    await use(authenticateFunc);
  },
};