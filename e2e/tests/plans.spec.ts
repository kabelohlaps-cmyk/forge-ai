import { expect, test } from '@playwright/test';
import { logIn, registerViaApi } from './helpers';

test('free plan: locked modes are disabled and usage is shown', async ({ page }) => {
  await logIn(page, await registerViaApi());
  await expect(page).toHaveURL(/\/projects$/);

  // Arriving from the Product mode card on a free plan.
  await page.goto('/projects?mode=product');
  const select = page.locator('select');
  await expect(page.getByText("Product isn't included in your plan.")).toBeVisible();
  await expect(select).toHaveValue('vehicle');
  await expect(select.locator('option[value=product]')).toBeDisabled();
  await expect(select.locator('option[value=interior]')).toBeEnabled();
  await expect(page.getByRole('link', { name: 'See plans' })).toHaveAttribute('href', '/billing');

  await page.goto('/dashboard');
  await expect(page.getByText(/0 of 10 renders used this month/)).toBeVisible();
});
