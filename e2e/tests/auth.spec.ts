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

test('sign out of all devices ends sessions elsewhere too', async ({ browser }) => {
  const email = await registerViaApi();
  const laptop = await browser.newPage();
  const phone = await (await browser.newContext()).newPage();
  for (const p of [laptop, phone]) {
    await logIn(p, email);
    await expect(p).toHaveURL(/\/projects$/);
  }

  await laptop.goto('/dashboard');
  await laptop.getByRole('button', { name: 'Sign out of all devices' }).click();
  await expect(laptop).toHaveURL(/\/login/);

  // The other device's session is now rejected by the API, and it is sent to log in.
  await phone.goto('/dashboard');
  await expect(phone).toHaveURL(/\/login/);

  await logIn(phone, email);
  await expect(phone).toHaveURL(/\/projects$/);
});

test('repeated wrong passwords lock the login with a clear message', async ({ page }) => {
  const email = await registerViaApi();
  for (let i = 0; i < 5; i++) {
    await logIn(page, email, 'wrong-password');
    await expect(page.getByText('Invalid email or password.')).toBeVisible();
  }
  await logIn(page, email); // right password, but locked for now
  await expect(page.getByText(/Too many failed sign-in attempts\. Try again in \d+ minute/)).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});
