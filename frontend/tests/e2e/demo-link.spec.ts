import { readFileSync } from 'node:fs';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { DEMO_SIGN_IN_NOTE } from '../../src/lib/copy';

// Journey: the /demo link (spec: Frontend: Demo sign-in; prd: Demo House > Demo link).
// POST /demo/assign and /auth/signin are throttled 5/min per client IP, so every browser context gets its own
// Fly-Client-IP. Assignment is least-recently-handed-out across a shared DB, so no test asserts a particular judge number.

const TOKEN_KEY = 'hushmate-token';
const DEMO_ACCOUNT_KEY = 'hushmate-demo-account';
const JUDGE_EMAIL = /^judge[1-5]@example\.com$/;

let ipCounter = Math.floor(Math.random() * 200) + 1;
const nextIp = () => `10.99.${Math.floor(Math.random() * 250)}.${(ipCounter = (ipCounter % 250) + 1)}`;

/** The demo password comes from the environment or backend/.env; it is never printed. */
function demoPassword(): string {
  if (process.env.DEMO_ACCOUNT_PASSWORD) return process.env.DEMO_ACCOUNT_PASSWORD;
  const env = readFileSync(new URL('../../../backend/.env', import.meta.url), 'utf8');
  const line = env.split('\n').find((l) => l.startsWith('DEMO_ACCOUNT_PASSWORD='));
  const value = line?.slice('DEMO_ACCOUNT_PASSWORD='.length).trim().replace(/^["']|["']$/g, '');
  if (!value) throw new Error('DEMO_ACCOUNT_PASSWORD is not set (env or backend/.env)');
  return value;
}

/** Gives the context its own client IP on the throttled routes. */
async function withOwnIp(context: BrowserContext): Promise<void> {
  const ip = nextIp();
  await context.route(/\/(demo\/assign|auth\/signin)$/, (route) =>
    route.continue({ headers: { ...route.request().headers(), 'fly-client-ip': ip } }),
  );
}

async function openDemo(page: Page): Promise<string> {
  await page.goto('/demo');
  await expect(page.getByRole('heading', { name: 'Try the demo' })).toBeVisible();
  const email = page.getByLabel('Email');
  await expect(email).toHaveValue(JUDGE_EMAIL); // waits for the assignment to land
  return email.inputValue();
}

test('demo link: a fresh browser gets a prefilled judge sign-in with the shared-account note, and Sign in lands in the demo house', async ({ browser }) => {
  const context = await browser.newContext();
  await withOwnIp(context);
  const page = await context.newPage();

  const email = await openDemo(page);
  expect(email).toMatch(JUDGE_EMAIL);
  await expect(page.getByLabel('Password')).toHaveValue(demoPassword());
  await expect(page.getByText(DEMO_SIGN_IN_NOTE)).toBeVisible();
  await expect(page.getByText(/sign out/i).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back to home' })).toBeVisible();
  expect(await page.evaluate((k) => localStorage.getItem(k), DEMO_ACCOUNT_KEY)).toBe(email);

  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/schedule$/);
  expect(await page.evaluate((k) => localStorage.getItem(k), TOKEN_KEY)).toBeTruthy();
  // The demo welcome card, or a simulated nudge's overlay (an alertdialog) that can arrive first and sit on top of it.
  await expect(
    page.getByRole('dialog', { name: 'Welcome to DevPost Demo House' }).or(page.getByRole('alertdialog', { name: 'A nudge from your house' })),
  ).toBeVisible();
  await expect(page.getByText('DevPost Demo House').first()).toBeVisible();

  await context.close();
});

test('demo link: revisiting /demo while signed in signs out, stays on /demo, and prefills the same account', async ({ browser }) => {
  const context = await browser.newContext();
  await withOwnIp(context);
  const page = await context.newPage();

  const first = await openDemo(page);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/schedule$/);
  await expect.poll(() => page.evaluate((k) => localStorage.getItem(k), TOKEN_KEY)).toBeTruthy();

  const second = await openDemo(page);
  expect(second).toBe(first);
  await expect(page).toHaveURL(/\/demo$/);
  expect(await page.evaluate((k) => localStorage.getItem(k), TOKEN_KEY)).toBeNull();
  await expect(page.getByLabel('Password')).toHaveValue(demoPassword());
  await expect(page.getByText(DEMO_SIGN_IN_NOTE)).toBeVisible();

  // Still signed out: a protected route sends the visitor to /signin.
  await page.goto('/schedule');
  await expect(page).toHaveURL(/\/signin$/);

  await context.close();
});

test('demo link: two fresh browsers opened back to back are handed different judges (least recently handed out)', async ({ browser }) => {
  const emails: string[] = [];
  for (let i = 0; i < 2; i++) {
    const context = await browser.newContext();
    await withOwnIp(context);
    emails.push(await openDemo(await context.newPage()));
    await context.close();
  }
  expect(emails[0]).toMatch(JUDGE_EMAIL);
  expect(emails[1]).toMatch(JUDGE_EMAIL);
  expect(emails[1]).not.toBe(emails[0]);
});

test('demo link: Back to home goes to the landing page without signing in', async ({ browser }) => {
  const context = await browser.newContext();
  await withOwnIp(context);
  const page = await context.newPage();

  await openDemo(page);
  await page.getByRole('link', { name: 'Back to home' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('link', { name: 'Sign up' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
  expect(await page.evaluate((k) => localStorage.getItem(k), TOKEN_KEY)).toBeNull();

  await context.close();
});

test('/signin is still the normal sign-in: Sign up link, no demo note, empty fields', async ({ browser }) => {
  const context = await browser.newContext();
  await withOwnIp(context);
  const page = await context.newPage();

  await page.goto('/signin');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page.getByLabel('Email')).toHaveValue('');
  await expect(page.getByLabel('Password')).toHaveValue('');
  await expect(page.getByRole('link', { name: 'Sign up' })).toBeVisible();
  await expect(page.getByText(/shared demo account/i)).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Try the demo' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Back to home' })).toHaveCount(0);

  await context.close();
});
