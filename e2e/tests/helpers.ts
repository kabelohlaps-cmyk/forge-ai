import { expect, type Page } from '@playwright/test';

export const API_URL = process.env.E2E_API_URL || 'http://localhost:8000';
export const PASSWORD = 'e2e-pass-123';

export function uniqueEmail(prefix = 'e2e') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

/** Creates an account straight through the API (faster than the signup form). */
export async function registerViaApi(email = uniqueEmail()) {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD, name: 'E2E Tester' }),
  });
  expect(res.ok, await res.clone().text()).toBeTruthy();
  return email;
}

export async function logIn(page: Page, email: string, password = PASSWORD) {
  await page.goto('/login');
  await page.fill('input[type=email]', email);
  await page.fill('input[type=password]', password);
  await page.click('form button[type=submit]');
}
