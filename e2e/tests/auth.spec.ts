import { expect, test } from '@playwright/test';
import { PASSWORD, logIn, registerViaApi, uniqueEmail } from './helpers';

test('sign up, create a project and see it listed', async ({ page }) => {
  await page.goto('/signup');
  await page.fill('input[placeholder=Name]', 'E2E Tester');
  await page.fill('input[type=email]', uniqueEmail('signup'));
  await page.fill('input[type=password]', PASSWORD);
  await page.click('form button[type=submit]');
  await expect(page).toHaveURL(/\/projects$/);

  await page.getByRole('button', { name: /new project/i }).click();
  await page.fill('input[placeholder="Project title"]', 'E2E Rover');
  await page.fill('[placeholder^="What are you building"]', 'six-wheeled desert rover');
  await page.click('form button[type=submit]');
  await expect(page).toHaveURL(/\/projects\/\d+$/);
  await expect(page.getByText('E2E Rover').first()).toBeVisible();

  await page.goto('/projects');
  await expect(page.getByText('E2E Rover')).toBeVisible();
});

test('sign out protects the workspace, and log in rejects a wrong password', async ({ page }) => {
  const email = await registerViaApi();
  await logIn(page, email);
  await expect(page).toHaveURL(/\/projects$/);

  await page.getByRole('button', { name: /sign out/i }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);

  await logIn(page, email, 'wrong-password');
  await expect(page.getByText('Invalid email or password.')).toBeVisible();

  await logIn(page, email);
  await expect(page).toHaveURL(/\/projects$/);
});
