import { expect, test } from '@playwright/test';
import { OUTBOX, linkFromOutbox, logIn, registerViaApi } from './helpers';

const resetLinkFor = (email: string) => linkFromOutbox(email, 'reset-password');

test.describe('password reset', () => {
  test.skip(!OUTBOX, 'set E2E_MAIL_OUTBOX to the API\'s MAIL_OUTBOX_DIR');

  test('forgot password → email link → new password → sign in', async ({ page }) => {
    const email = await registerViaApi();
    await page.goto('/login');
    await page.getByRole('link', { name: 'Forgot password?' }).click();
    await expect(page).toHaveURL(/\/forgot-password$/);
    await page.fill('input[type=email]', email);
    await page.getByRole('button', { name: 'Send reset link' }).click();
    await expect(page.getByText("If an account exists for that email, we've sent a link")).toBeVisible();

    const link = await resetLinkFor(email);
    await page.goto(link);
    const fields = page.locator('input[type=password]');
    await fields.nth(0).fill('my-new-password');
    await fields.nth(1).fill('my-new-password');
    await page.getByRole('button', { name: 'Set new password' }).click();
    await expect(page.getByText('Your password has been changed.')).toBeVisible();

    await logIn(page, email, 'e2e-pass-123'); // the old password no longer works
    await expect(page.getByText('Invalid email or password.')).toBeVisible();
    await logIn(page, email, 'my-new-password');
    await expect(page).toHaveURL(/\/projects$/);

    // The link can't be used a second time.
    await page.goto(link);
    await fields.nth(0).fill('yet-another-pass');
    await fields.nth(1).fill('yet-another-pass');
    await page.getByRole('button', { name: 'Set new password' }).click();
    await expect(page.getByText('This reset link is invalid or has expired.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Request a new link' })).toBeVisible();
  });

  test('mismatched passwords are caught before submitting', async ({ page }) => {
    await page.goto('/reset-password?token=anything');
    const fields = page.locator('input[type=password]');
    await fields.nth(0).fill('first-password');
    await fields.nth(1).fill('second-password');
    await page.getByRole('button', { name: 'Set new password' }).click();
    await expect(page.getByText("The passwords don't match.")).toBeVisible();
  });
});
