import { expect, test } from '@playwright/test';

test('3D studio loads the rigged model from local assets', async ({ page }) => {
  const offsite: string[] = [];
  page.on('request', (r) => {
    const { hostname, protocol } = new URL(r.url());
    const local = ['localhost', '127.0.0.1'].includes(hostname) || protocol === 'data:' || protocol === 'blob:';
    // Google Fonts is the only expected third-party request.
    if (!local && !hostname.endsWith('googleapis.com') && !hostname.endsWith('gstatic.com')) offsite.push(r.url());
  });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/lab/3d');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByText(/Matched \d+ arm bone\(s\), \d+ leg bone\(s\)/)).toBeVisible({ timeout: 45_000 });
  expect(offsite).toEqual([]);
  expect(errors).toEqual([]);
});
