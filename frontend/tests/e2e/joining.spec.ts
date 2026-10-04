import { expect, test, type APIRequestContext } from '@playwright/test';

// Journey: B asks to join A's house by ID -> "Request sent", no setup; A approves -> B's next open goes to setup for that house.

const API = 'http://localhost:3000';
const TOKEN_KEY = 'hushmate-token'; // frontend/src/api/session.ts

let ipCounter = Math.floor(Math.random() * 200) + 1;
const nextIp = () => `10.79.${Math.floor(Math.random() * 250)}.${(ipCounter = (ipCounter % 250) + 1)}`;

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

test('joining: B requests by house ID and waits, then is routed to setup once A approves', async ({ browser, request }) => {
  const run = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const a = await signUp(request, `Ada${run.slice(-4)}`, run);
  const b = await signUp(request, `Ben${run.slice(-4)}`, run);
  const houseName = `Join${run.slice(-6)}`;

  const created = await request.post(`${API}/houses`, { headers: auth(a), data: { name: houseName } });
  expect(created.status()).toBe(201);
  const house = (await created.json()).house as { id: string; name: string; code: string };

  const context = await browser.newContext();
  await context.addInitScript(([key, token]) => localStorage.setItem(key, token), [TOKEN_KEY, b.token]);
  const page = await context.newPage();

  try {
    // B has no membership yet, so signing in lands on onboarding. Join by ID.
    await page.goto('/onboarding');
    await page.getByRole('button', { name: /Join a house/ }).click();
    await page.getByLabel('House ID').fill(`${house.name}#${house.code}`);
    await page.getByRole('button', { name: 'Find house' }).click();
    await page.getByRole('button', { name: 'Request to join' }).click();

    // Request sent: nothing else is offered, and no setup yet.
    await expect(page.getByText('Request sent')).toBeVisible();
    await expect(page.getByText(/Once you're in, you'll set up your quiet times/)).toBeVisible();
    await expect(page).toHaveURL(/\/onboarding$/);

    // Still pending after a reload: no setup redirect for a pending request.
    await page.goto('/schedule');
    await expect(page).toHaveURL(/\/schedule$/);
    await expect(page.getByRole('button', { name: "Let's go" })).toHaveCount(0);

    // A approves through the API.
    const requests = await request.get(`${API}/houses/${house.id}/requests`, { headers: auth(a) });
    expect(requests.status()).toBe(200);
    const pending = (await requests.json()) as Array<{ id?: string; membershipId?: string; user?: { id: string } }>;
    const mine = pending.find((r) => r.user?.id === b.id) ?? pending[0];
    const membershipId = (mine.membershipId ?? mine.id) as string;
    expect((await request.post(`${API}/memberships/${membershipId}/approve`, { headers: auth(a) })).status()).toBe(200);

    // B's next open is routed to setup for that house, starting with the joiner intro.
    await page.reload();
    await expect(page).toHaveURL(new RegExp(`/onboarding/setup/${house.id}$`));
    await expect(page.getByText(`You're in ${houseName}`)).toBeVisible();
    await page.getByRole('button', { name: "Let's go" }).click();
    await expect(page.getByRole('heading', { name: 'Your quiet times' })).toBeVisible();
  } finally {
    await context.close();
  }
});
