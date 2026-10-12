import { expect, test } from '@playwright/test';
import { OUTBOX, PASSWORD, linkFromOutbox, uniqueEmail } from './helpers';

test.describe('email verification', () => {
  test.skip(!OUTBOX, "set E2E_MAIL_OUTBOX to the API's MAIL_OUTBOX_DIR");

  test('sign up → banner → emailed link verifies → banner gone', async ({ page }) => {
    const email = uniqueEmail('verify');
    await page.goto('/signup');
    await page.fill('input[placeholder=Name]', 'Verify Tester');
    await page.fill('input[type=email]', email);
    await page.fill('input[type=password]', PASSWORD);
    await page.click('form button[type=submit]');
    await expect(page).toHaveURL(/\/projects$/);
    const banner = page.getByTestId('verify-email-banner');
    await expect(banner).toContainText(`We sent a link to ${email}`);

    // Resend from the banner.
    await banner.getByRole('button', { name: 'Resend the link' }).click();
    await expect(banner).toContainText('New link sent');

    await page.goto(await linkFromOutbox(email, 'verify-email'));
    await expect(page.getByText('Your email address is verified.')).toBeVisible();

    await page.goto('/dashboard');
    await expect(page.getByText(/renders used this month/)).toBeVisible();
    await expect(page.getByTestId('verify-email-banner')).toHaveCount(0);
  });

  test('a bad link offers to send a new one', async ({ page }) => {
    await page.goto('/verify-email?token=not-a-real-token');
    await expect(page.getByText('This verification link is invalid or has expired.')).toBeVisible();
    await page.fill('input[type=email]', 'someone@example.com');
    await page.getByRole('button', { name: 'Send a new link' }).click();
    await expect(page.getByText("If that account still needs verifying, we've sent a new link.")).toBeVisible();
  });
});
