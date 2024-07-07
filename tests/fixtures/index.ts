import { test as base } from '@playwright/test';
import { accessibilityFixture, AccessibilityFixture } from './accessibility';
import { loginSelectorsFixture, LoginSelectorsFixture } from './loginSelectors';
import { authenticationFixture, AuthenticationFixture } from './authentication';

type FixtureTypes = LoginSelectorsFixture & AuthenticationFixture & AccessibilityFixture;

const fixture = {
  ...loginSelectorsFixture,
  ...authenticationFixture,
  ...accessibilityFixture,
};

export const test = base.extend<FixtureTypes>(fixture as any);
export { expect } from '@playwright/test';