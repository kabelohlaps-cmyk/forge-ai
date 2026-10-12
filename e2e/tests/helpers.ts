import { expect, type Page } from '@playwright/test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

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

/** Where the API writes outgoing mail when MAIL_OUTBOX_DIR is set (services/api/app/services/mailer.py). */
export const OUTBOX = process.env.E2E_MAIL_OUTBOX;

/** The newest link to /<page>?token=... emailed to `email`, as a path the test can goto(). */
export async function linkFromOutbox(email: string, page: 'reset-password' | 'verify-email'): Promise<string> {
  const pattern = new RegExp(`https?://\\S+/${page}\\?token=[\\w-]+`);
  let link: string | undefined;
  await expect
    .poll(() => {
      if (!existsSync(OUTBOX!)) return undefined;
      const mails = readdirSync(OUTBOX!).sort().map((f) => JSON.parse(readFileSync(join(OUTBOX!, f), 'utf8')));
      link = mails.filter((m) => m.to === email && pattern.test(m.body)).pop()?.body.match(pattern)?.[0];
      return link;
    }, { timeout: 10_000 })
    .toBeTruthy();
  const url = new URL(link!);
  return url.pathname + url.search;
}
