import { expect, test } from '@playwright/test';

// Journey: sign up through the UI -> no memberships -> /onboarding -> create a house -> setup (add a quiet time,
// notifications step) -> Schedule showing the quiet time block.

let ipCounter = Math.floor(Math.random() * 200) + 1;
const nextIp = () => `10.78.${Math.floor(Math.random() * 250)}.${(ipCounter = (ipCounter % 250) + 1)}`;

test('onboarding: sign up, create a house, add a quiet time, land on Schedule with the block', async ({ page }) => {
  const run = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const name = `Olive${run.slice(-4)}`;
  const houseName = `Onboard${run.slice(-6)}`;

  // Signups are rate limited per client IP (5/min/route); give this browser its own address.
  await page.route('**/auth/signup', (route) => route.continue({ headers: { ...route.request().headers(), 'fly-client-ip': nextIp() } }));

  await page.goto('/signup');
  await page.getByLabel('Your name').fill(name);
  await page.getByLabel('Email').fill(`${name.toLowerCase()}-${run}@example.com`);
  await page.getByLabel('Password').fill('correct horse');
  await page.getByRole('button', { name: 'Sign up' }).click();

  // No memberships -> onboarding.
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByRole('heading', { name: 'Set up your house' })).toBeVisible();
  await page.getByRole('button', { name: /Create a house/ }).click();

  await page.getByLabel('House name').fill(houseName);
  await page.getByRole('button', { name: 'Create house' }).click();
  await expect(page.getByRole('heading', { name: `${houseName} is ready` })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();

  // Setup step 1: the creator skips the intro and goes straight to quiet times.
  await expect(page).toHaveURL(/\/onboarding\/setup\/[0-9a-f-]+$/);
  await expect(page.getByRole('heading', { name: 'Your quiet times' })).toBeVisible();
  await page.getByRole('button', { name: 'Add quiet time' }).click();

  const sheet = page.getByRole('dialog', { name: 'New quiet time' });
  await expect(sheet).toBeVisible();
  // Defaults are 11:00 PM -> 7:00 AM on Mon, Wed, Fri. Select every night so today always shows a block.
  for (const day of ['Tue', 'Thu', 'Sat', 'Sun']) await sheet.getByRole('button', { name: day, exact: true }).click();
  await sheet.getByRole('button', { name: 'Save quiet time' }).click();
  await expect(sheet).toHaveCount(0);

  // The saved set is listed, and Continue replaces Skip.
  await expect(page.getByText('11:00 PM → 7:00 AM (next day)').first()).toBeVisible();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();

  // Setup step 2: notifications. Chromium has no push set up, so the person continues or skips.
  await expect(page.getByRole('heading', { name: /Hear about nudges|Notifications are on/ })).toBeVisible();
  await page.getByRole('button', { name: /^(continue|skip for now|go to schedule)$/i }).click();

  // Schedule shows the quiet time block (your own, so it is a button labelled for editing).
  await expect(page).toHaveURL(/\/schedule$/);
  await expect(page.getByRole('button', { name: /You, quiet time 11:00 PM to 7:00 AM \(next day\)/ }).first()).toBeVisible();
  await expect(page.getByText('No quiet times yet')).toHaveCount(0);

  // Setup is done: a reload stays on Schedule instead of going back to setup.
  await page.reload();
  await expect(page).toHaveURL(/\/schedule$/);
  await expect(page.getByRole('button', { name: /You, quiet time 11:00 PM to 7:00 AM/ }).first()).toBeVisible();
});
