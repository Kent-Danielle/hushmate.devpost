import { expect, test, type APIRequestContext } from '@playwright/test';

const API = 'http://localhost:3000';
const TOKEN_KEY = 'hushmate-token'; // frontend/src/api/session.ts

let ipCounter = Math.floor(Math.random() * 200) + 1;
const nextIp = () => `10.77.${Math.floor(Math.random() * 250)}.${(ipCounter = (ipCounter % 250) + 1)}`;

interface Person {
  id: string;
  name: string;
  token: string;
}

async function signUp(api: APIRequestContext, name: string, run: string): Promise<Person> {
  const res = await api.post(`${API}/auth/signup`, {
    headers: { 'Fly-Client-IP': nextIp() },
    data: { name, email: `${name.toLowerCase()}-${run}@example.com`, password: 'correct horse' },
  });
  expect(res.status()).toBe(201);
  const body = await res.json();
  return { id: body.user.id, name, token: body.token };
}

const auth = (p: Person) => ({ Authorization: `Bearer ${p.token}` });

test('the nudge round trip: A nudges B, B sees the overlay and taps Got it, A sees it on Summary', async ({ browser, request }) => {
  const run = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const nameA = `Ayla${run.slice(-4)}`;
  const nameB = `Bram${run.slice(-4)}`;

  // Arrange through the API: two users, a house, B joins and is approved.
  const a = await signUp(request, nameA, run);
  const b = await signUp(request, nameB, run);
  const house = await request.post(`${API}/houses`, { headers: auth(a), data: { name: `House${run.slice(-5)}` } });
  expect(house.status()).toBe(201);
  const houseId = (await house.json()).house.id as string;
  const joined = await request.post(`${API}/houses/${houseId}/join`, { headers: auth(b) });
  expect(joined.status()).toBe(201);
  const membershipId = (await joined.json()).membershipId as string;
  expect((await request.post(`${API}/memberships/${membershipId}/approve`, { headers: auth(a) })).status()).toBe(200);
  expect((await request.post(`${API}/houses/${houseId}/activate`, { headers: auth(b) })).status()).toBe(201);

  // Both finish setup, so neither is redirected into the setup flow (an approved membership with setupDone false is).
  for (const p of [a, b]) {
    const list = (await (await request.get(`${API}/houses`, { headers: auth(p) })).json()) as Array<{ membershipId: string; house: { id: string } }>;
    const mine = list.find((h) => h.house.id === houseId);
    expect(mine).toBeTruthy();
    expect((await request.post(`${API}/memberships/${mine!.membershipId}/setup-done`, { headers: auth(p) })).status()).toBe(204);
  }

  // Two independent browser contexts, each signed in by seeding the session token. Push is stubbed: nobody subscribes.
  const open = async (p: Person) => {
    const context = await browser.newContext();
    await context.addInitScript(([key, token]) => localStorage.setItem(key, token), [TOKEN_KEY, p.token]);
    const page = await context.newPage();
    return { context, page };
  };
  const ctxA = await open(a);
  const ctxB = await open(b);

  try {
    // B is waiting on the schedule with nothing pending.
    await ctxB.page.goto('/schedule');
    await expect(ctxB.page.getByRole('button', { name: 'Nudge' })).toBeVisible();
    await expect(ctxB.page.getByRole('alertdialog')).toHaveCount(0);

    // A nudges B through the UI.
    await ctxA.page.goto('/schedule');
    await ctxA.page.getByRole('button', { name: 'Nudge' }).click();
    const sheet = ctxA.page.getByRole('dialog', { name: "Who's being loud?" });
    await expect(sheet).toBeVisible();
    await sheet.getByRole('button', { name: new RegExp(nameB) }).click();
    await expect(ctxA.page.getByText('Nudge sent quietly').first()).toBeVisible();
    await expect(ctxA.page.getByText(/Nudge again in \d+:\d{2}/)).toBeVisible();

    // B's overlay comes from pending on focus (no push in the test).
    // TanStack Query refetches on visibilitychange (what a refocus fires).
    await ctxB.page.evaluate(() => document.dispatchEvent(new Event('visibilitychange', { bubbles: true })));
    const overlay = ctxB.page.getByRole('alertdialog', { name: 'A nudge from your house' });
    await expect(overlay).toBeVisible();
    // The sender is anonymous.
    await expect(overlay).not.toContainText(nameA);

    await overlay.getByRole('button', { name: 'Got it' }).click();
    await expect(overlay).toHaveCount(0);

    // A's Summary shows who tapped Got it.
    await ctxA.page.goto('/summary');
    await expect(ctxA.page.getByText(`${nameB} tapped Got it`).first()).toBeVisible();

    // Reloading B does not bring the overlay back.
    await ctxB.page.reload();
    await expect(ctxB.page.getByRole('button', { name: 'Nudge' })).toBeVisible();
    await expect(ctxB.page.getByRole('alertdialog')).toHaveCount(0);
  } finally {
    await ctxA.context.close();
    await ctxB.context.close();
  }
});
