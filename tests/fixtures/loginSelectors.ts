import { Fixtures } from '@playwright/test';

type GetLoginSelectors = (siteName: string) => {
  usernameInput: string;
  passwordInput: string;
  loginButton: string;
};

export type LoginSelectorsFixture = {
  getLoginSelectors: GetLoginSelectors;
};

export const loginSelectorsFixture: Fixtures<LoginSelectorsFixture> = {
  getLoginSelectors: async ({}, use) => {
    const getSelectors: GetLoginSelectors = (siteName: string) => {
      const usernameInput = process.env[`${siteName.toUpperCase()}_USERNAME_SELECTOR`] || '#username';
      const passwordInput = process.env[`${siteName.toUpperCase()}_PASSWORD_SELECTOR`] || '#password';
      const loginButton = process.env[`${siteName.toUpperCase()}_LOGIN_BUTTON_SELECTOR`] || '#login-button';

      return { usernameInput, passwordInput, loginButton };
    };

    await use(getSelectors);
  },
};