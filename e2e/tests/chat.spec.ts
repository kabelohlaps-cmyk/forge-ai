import { expect, test, type Page } from '@playwright/test';
import { API_URL, PASSWORD, logIn, uniqueEmail } from './helpers';

/** A logged-in user with one fresh vehicle project, opened in the chat page. */
async function openNewProject(page: Page, brief = '') {
  const email = uniqueEmail('chat');
  const reg = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD, name: 'Chat Tester' }),
  });
  const { token } = await reg.json();
  const proj = await fetch(`${API_URL}/projects/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ title: 'Chat Rover', mode: 'vehicle', brief }),
  });
  const project = await proj.json();
  await logIn(page, email);
  await expect(page).toHaveURL(/\/projects$/);
  await page.goto(`/projects/${project.id}`);
  await expect(page.getByRole('heading', { name: 'Chat Rover' })).toBeVisible();
}

const json = (status: number, body: unknown) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });

async function send(page: Page, text: string) {
  await page.fill('input[name=prompt]', text);
  await page.getByRole('button', { name: 'Forge' }).click();
}

test('new project shows an empty state with its brief', async ({ page }) => {
  await openNewProject(page, 'six-wheeled desert rover');
  await expect(page.getByText('Nothing forged yet.')).toBeVisible();
  await expect(page.getByText('Start with your brief: "six-wheeled desert rover"')).toBeVisible();
});

test('a failed send keeps the chat, marks the message, and can be retried', async ({ page }) => {
  await openNewProject(page);
  // The agent is down: a plain-text 500, as uvicorn returns for an unhandled error.
  await page.route(`${API_URL}/agent/invoke`, (r) => r.fulfill({ status: 500, body: 'Internal Server Error' }));
  await send(page, 'design a rover');

  await expect(page.getByTestId('action-error')).toContainText('The server had a problem (500). Please try again.');
  await expect(page.getByText('design a rover')).toBeVisible();
  await expect(page.getByText('Not sent.')).toBeVisible();
  await expect(page.locator('input[name=prompt]')).toBeVisible(); // the chat is still there

  await page.unroute(`${API_URL}/agent/invoke`);
  await page.route(`${API_URL}/agent/invoke`, (r) => r.fulfill(json(200, { reply: 'Here is a rover concept.' })));
  await page.getByRole('button', { name: 'Retry' }).click();

  await expect(page.getByText('Here is a rover concept.')).toBeVisible();
  await expect(page.getByText('Not sent.')).toHaveCount(0);
  await expect(page.getByTestId('action-error')).toHaveCount(0);
  await expect(page.getByText('design a rover')).toHaveCount(1); // retried in place, not duplicated
});

test('sending is locked while a reply is pending', async ({ page }) => {
  await openNewProject(page);
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  let calls = 0;
  await page.route(`${API_URL}/agent/invoke`, async (r) => {
    calls++;
    await gate;
    await r.fulfill(json(200, { reply: 'Done.' }));
  });
  await send(page, 'first');
  await expect(page.getByRole('button', { name: 'Forging…' })).toBeDisabled();
  await page.fill('input[name=prompt]', 'second');
  await page.locator('input[name=prompt]').press('Enter');
  release();
  await expect(page.getByText('Done.')).toBeVisible();
  expect(calls).toBe(1);
});

test('a plan-limit error on image generation links to plans and keeps the chat', async ({ page }) => {
  await openNewProject(page);
  await page.route(`${API_URL}/agent/invoke`, (r) => r.fulfill(json(200, { reply: 'A rover concept.' })));
  await page.route(`${API_URL}/agent/generate-image`, (r) =>
    r.fulfill(json(403, { detail: "You've used all 10 renders on your plan this month" }))
  );
  await send(page, 'design a rover');
  await page.getByRole('button', { name: '✦ Generate Image' }).click();

  const alert = page.getByTestId('action-error');
  await expect(alert).toContainText("You've used all 10 renders on your plan this month");
  await expect(alert.getByRole('link', { name: 'See plans' })).toHaveAttribute('href', '/billing');
  await expect(page.getByText('A rover concept.')).toBeVisible();
  await expect(page.getByRole('button', { name: '✦ Generate Image' })).toBeEnabled();

  await page.getByRole('button', { name: 'Dismiss' }).click();
  await expect(alert).toHaveCount(0);
});

test('validation errors are readable, not [object Object]', async ({ page }) => {
  await openNewProject(page);
  await page.route(`${API_URL}/agent/invoke`, (r) => r.fulfill(json(200, { reply: 'A rover concept.' })));
  await page.route(`${API_URL}/agent/generate-image`, (r) =>
    r.fulfill(json(422, { detail: [{ loc: ['body', 'sketch_data_uri'], msg: 'String should have at most 11184874 characters' }] }))
  );
  await send(page, 'design a rover');
  await page.getByRole('button', { name: '✦ Generate Image' }).click();
  await expect(page.getByTestId('action-error')).toContainText('String should have at most 11184874 characters');
  await expect(page.getByTestId('action-error')).not.toContainText('object Object');
});

test('a project that does not exist offers a way back', async ({ page }) => {
  await openNewProject(page);
  await page.goto('/projects/999999');
  await expect(page.getByText('Project not found')).toBeVisible();
  await expect(page.getByRole('link', { name: '← Back to your projects' })).toHaveAttribute('href', '/projects');
});
