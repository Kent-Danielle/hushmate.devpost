import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { DEMO_STREAK_NOTE } from '../../src/lib/copy';

const API = 'http://localhost:3000';
const JUDGE = 'judge1@example.com';
const SEEN_KEY = 'hushmate-demo-welcome-seen';

/** The demo password comes from the environment or backend/.env; it is never printed. */
function demoPassword(): string {
  if (process.env.DEMO_ACCOUNT_PASSWORD) return process.env.DEMO_ACCOUNT_PASSWORD;
  const env = readFileSync(new URL('../../../backend/.env', import.meta.url), 'utf8');
  const line = env.split('\n').find((l) => l.startsWith('DEMO_ACCOUNT_PASSWORD='));
  const value = line?.slice('DEMO_ACCOUNT_PASSWORD='.length).trim().replace(/^["']|["']$/g, '');
  if (!value) throw new Error('DEMO_ACCOUNT_PASSWORD is not set (env or backend/.env)');
  return value;
}

test('demo locks: judge sees the welcome card once, no house-changing controls, and the fixed streak note', async ({ page, request }) => {
  const password = demoPassword();

  // Clear any simulated-housemate nudge that would put the overlay over the page.
  const signin = await request.post(`${API}/auth/signin`, {
    headers: { 'Fly-Client-IP': `10.88.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250) + 1}` },
    data: { email: JUDGE, password },
  });
  expect(signin.status(), 'judge1 must exist: run `docker compose exec backend npm run seed`').toBe(200);
  const { token } = await signin.json();
  const ack = await request.post(`${API}/nudges/acknowledge`, { headers: { Authorization: `Bearer ${token}` } });
  expect(ack.ok()).toBe(true);

  // Sign in through the UI.
  await page.goto('/signin');
  await page.evaluate((key) => localStorage.removeItem(key), SEEN_KEY);
  await page.getByLabel('Email').fill(JUDGE);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();

  // Welcome card, with the bot names.
  const card = page.getByRole('dialog', { name: 'Welcome to DevPost Demo House' });
  await expect(card).toBeVisible();
  await expect(card).toContainText('Maya, Jordan and Priya');
  await expect(card).toContainText('are simulated housemates');
  await card.getByRole('button', { name: 'Show me around' }).click();
  await expect(card).toHaveCount(0);

  // Reload: no card again.
  await page.reload();
  await expect(page.getByRole('navigation').first()).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Welcome to DevPost Demo House' })).toHaveCount(0);

  // Houses: the demo house is there, and every house-changing control is hidden.
  await page.goto('/houses');
  await expect(page.getByText('DevPost Demo House').first()).toBeVisible();
  for (const name of [/create house/i, /join a house/i, /make active/i, /copy invite link/i, /dismiss/i, /requests/i]) {
    await expect(page.getByRole('button', { name })).toHaveCount(0);
  }
  await expect(page.getByRole('link', { name: /create house|join a house/i })).toHaveCount(0);

  // Summary: streak 10 and the demo note.
  await page.goto('/summary');
  const tile = page.getByRole('region', { name: 'Quiet Streak' });
  await expect(tile).toBeVisible();
  await expect(tile).toContainText('10 days without a nudge');
  await expect(tile).toContainText(DEMO_STREAK_NOTE);
});
