import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import type { Prisma, PrismaClient } from '../generated/prisma/client.js';
import { HASH_OPTIONS } from '../auth/auth.service.js';
import { latestVancouver3am, vancouverParts, vancouverToInstant } from '../common/vancouverTime.js';
import { randomInviteToken } from '../common/random.js';

/** Either the root client or an interactive-transaction client. */
export type DemoDb = PrismaClient | Prisma.TransactionClient;

export const DEMO_HOUSE_NAME = 'DevPost Demo House';
export const DEMO_HOUSE_CODE = '202610';
export const LAST_DEMO_RESET_KEY = 'lastDemoResetAt';

export interface DemoPerson {
  name: string;
  email: string;
}

/** Bots, in colorIndex order 0-2. Maya owns the demo house. */
export const DEMO_BOTS: readonly DemoPerson[] = [
  { name: 'Maya', email: 'maya.bot@example.com' },
  { name: 'Jordan', email: 'jordan.bot@example.com' },
  { name: 'Priya', email: 'priya.bot@example.com' },
];

/** Judge accounts, colorIndex 3, 4, then 0, 1, 2 (members six to eight repeat the first three pastels). */
export const DEMO_JUDGES: readonly DemoPerson[] = [
  { name: 'Judge 1', email: 'judge1@example.com' },
  { name: 'Judge 2', email: 'judge2@example.com' },
  { name: 'Judge 3', email: 'judge3@example.com' },
  { name: 'Judge 4', email: 'judge4@example.com' },
  { name: 'Judge 5', email: 'judge5@example.com' },
];

const MEMBER_COLORS = [0, 1, 2, 3, 4, 0, 1, 2] as const;

export interface BotQuietTime {
  days: readonly number[]; // 0 = Sunday; the night the block starts
  startMinute: number;
  endMinute: number; // end <= start: ends the next morning
}

const h = (hours: number, minutes = 0): number => hours * 60 + minutes;
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6] as const;

/** Keyed by bot email. Each entry is one "set" (one setId shared by its rows). */
export const BOT_QUIET_TIMES: Readonly<Record<string, readonly BotQuietTime[]>> = {
  'maya.bot@example.com': [{ days: [0, 1, 2, 3, 4], startMinute: h(23), endMinute: h(7) }],
  'jordan.bot@example.com': [
    { days: ALL_DAYS, startMinute: h(20, 30), endMinute: h(4, 30) },
    { days: [6], startMinute: h(13), endMinute: h(15) },
  ],
  'priya.bot@example.com': [
    { days: [1, 2, 3, 4, 5], startMinute: h(6), endMinute: h(9) },
    { days: [5, 6], startMinute: h(22, 30), endMinute: h(6) },
  ],
};

export interface BotHeadsUp {
  email: string;
  text: string;
  dayOffset: number; // 0 = today (Vancouver), 1 = tomorrow
  minuteOfDay: number;
}

export const BOT_HEADS_UPS: readonly BotHeadsUp[] = [
  { email: 'priya.bot@example.com', text: 'Coming home late, might make late dinner', dayOffset: 0, minuteOfDay: h(23, 30) },
  { email: 'maya.bot@example.com', text: 'Friends over for a movie', dayOffset: 1, minuteOfDay: h(20) },
];

/** The instant of a Vancouver wall-clock time, `dayOffset` calendar days after the day of `now`. */
export function vancouverWallTime(now: Date, dayOffset: number, minuteOfDay: number): Date {
  const p = vancouverParts(now);
  const hourStart = vancouverToInstant(p.year, p.month, p.day + dayOffset, Math.floor(minuteOfDay / 60));
  return new Date(hourStart.getTime() + (minuteOfDay % 60) * 60_000);
}

/** The demo password from the environment, or undefined when it isn't set. */
function demoPassword(): string | undefined {
  return process.env.DEMO_ACCOUNT_PASSWORD || undefined;
}

/** A hash to store for the demo password: reuses the existing one when it still verifies (so re-runs change nothing). */
async function hashFor(existing: string | null | undefined, password: string): Promise<string> {
  if (existing) {
    const same = await argon2.verify(existing, password).catch(() => false);
    if (same) return existing;
  }
  return argon2.hash(password, HASH_OPTIONS);
}

/** Precompute hashes outside any transaction (argon2 is CPU-heavy). */
async function judgeHashes(db: DemoDb, password: string | undefined): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!password) return out;
  const existing = await db.user.findMany({
    where: { email: { in: DEMO_JUDGES.map((j) => j.email) } },
    select: { email: true, passwordHash: true },
  });
  const byEmail = new Map(existing.map((u) => [u.email, u.passwordHash]));
  for (const judge of DEMO_JUDGES) out.set(judge.email, await hashFor(byEmail.get(judge.email), password));
  return out;
}

export interface UpsertOptions {
  /** Defaults to env DEMO_ACCOUNT_PASSWORD. Without it, new judge accounts get no password and existing hashes are kept. */
  password?: string;
  /** Pre-computed judge hashes (used by resetDemoContent so hashing stays outside its transaction). */
  hashes?: Map<string, string>;
}

/**
 * Create or refresh the demo world, upserted by email so IDs stay stable:
 * 3 bots, 5 judge accounts, the demo house (owned by Maya), eight approved memberships
 * with setup done, and the demo house as everyone's active house. Idempotent.
 */
export async function upsertDemoWorld(db: DemoDb, options: UpsertOptions = {}): Promise<{ houseId: string }> {
  const hashes = options.hashes ?? (await judgeHashes(db, options.password ?? demoPassword()));
  const people = [
    ...DEMO_BOTS.map((p) => ({ ...p, isBot: true, isDemo: false })),
    ...DEMO_JUDGES.map((p) => ({ ...p, isBot: false, isDemo: true })),
  ];

  const ids: string[] = [];
  for (const p of people) {
    const hash = p.isBot ? null : (hashes.get(p.email) ?? null);
    const user = await db.user.upsert({
      where: { email: p.email },
      create: { name: p.name, email: p.email, isBot: p.isBot, isDemo: p.isDemo, passwordHash: hash },
      update: {
        name: p.name,
        isBot: p.isBot,
        isDemo: p.isDemo,
        ...(p.isBot ? { passwordHash: null } : hash ? { passwordHash: hash } : {}),
      },
      select: { id: true },
    });
    ids.push(user.id);
  }

  const maya = ids[0]!;
  const nameKey = DEMO_HOUSE_NAME.toLowerCase();
  const house = await db.house.upsert({
    where: { nameKey_code: { nameKey, code: DEMO_HOUSE_CODE } },
    create: {
      name: DEMO_HOUSE_NAME,
      nameKey,
      code: DEMO_HOUSE_CODE,
      inviteToken: randomInviteToken(),
      ownerId: maya,
      isDemo: true,
    },
    update: { name: DEMO_HOUSE_NAME, ownerId: maya, isDemo: true },
    select: { id: true },
  });

  const setupDoneAt = new Date();
  for (const [i, userId] of ids.entries()) {
    const existing = await db.membership.findUnique({
      where: { userId_houseId: { userId, houseId: house.id } },
      select: { setupDoneAt: true, decidedAt: true },
    });
    await db.membership.upsert({
      where: { userId_houseId: { userId, houseId: house.id } },
      create: { userId, houseId: house.id, status: 'approved', colorIndex: MEMBER_COLORS[i]!, decidedAt: setupDoneAt, setupDoneAt },
      update: {
        status: 'approved',
        colorIndex: MEMBER_COLORS[i]!,
        decidedAt: existing?.decidedAt ?? setupDoneAt,
        setupDoneAt: existing?.setupDoneAt ?? setupDoneAt,
      },
    });
    await db.user.updateMany({ where: { id: userId, OR: [{ activeHouseId: null }, { NOT: { activeHouseId: house.id } }] }, data: { activeHouseId: house.id } });
  }
  return { houseId: house.id };
}

/** Delete bot quiet times in the demo house and re-insert the canonical ones. */
async function restoreBotQuietTimes(db: DemoDb, houseId: string): Promise<void> {
  const bots = await db.user.findMany({ where: { email: { in: DEMO_BOTS.map((b) => b.email) } }, select: { id: true, email: true } });
  const rows: Prisma.QuietTimeCreateManyInput[] = [];
  for (const bot of bots) {
    for (const set of BOT_QUIET_TIMES[bot.email] ?? []) {
      const setId = randomUUID();
      for (const dayOfWeek of set.days) {
        rows.push({ userId: bot.id, houseId, setId, dayOfWeek, startMinute: set.startMinute, endMinute: set.endMinute });
      }
    }
  }
  await db.quietTime.createMany({ data: rows });
}

/**
 * The nightly reset, in one transaction. Returns true when it ran, false when
 * the guard says it already ran since the latest 03:00 Vancouver (a no-op).
 */
export async function resetDemoContent(prisma: PrismaClient, now: Date = new Date()): Promise<boolean> {
  const password = demoPassword();
  const hashes = await judgeHashes(prisma, password);
  const cutoff = latestVancouver3am(now);

  return prisma.$transaction(
    async (tx) => {
      const claimed = await tx.$queryRaw<{ key: string }[]>`
        INSERT INTO system_state (key, value) VALUES (${LAST_DEMO_RESET_KEY}, now())
        ON CONFLICT (key) DO UPDATE SET value = now() WHERE system_state.value < ${cutoff}
        RETURNING key`;
      if (claimed.length === 0) return false;

      const world = await upsertDemoWorld(tx, { hashes });
      const demoUsers = await tx.user.findMany({ where: { OR: [{ isDemo: true }, { isBot: true }] }, select: { id: true } });
      const userIds = demoUsers.map((u) => u.id);

      await tx.nudge.deleteMany({ where: { houseId: world.houseId } });
      await tx.headsUp.deleteMany({ where: { houseId: world.houseId } });
      await tx.quietTime.deleteMany({ where: { houseId: world.houseId, userId: { in: userIds } } });

      await restoreBotQuietTimes(tx, world.houseId);

      const bots = await tx.user.findMany({ where: { email: { in: DEMO_BOTS.map((b) => b.email) } }, select: { id: true, email: true } });
      const botId = new Map(bots.map((b) => [b.email, b.id]));
      await tx.headsUp.createMany({
        data: BOT_HEADS_UPS.map((hu) => ({
          houseId: world.houseId,
          authorId: botId.get(hu.email)!,
          text: hu.text,
          at: vancouverWallTime(now, hu.dayOffset, hu.minuteOfDay),
        })),
      });

      await tx.user.updateMany({ where: { isDemo: true }, data: { demoNextNudgeAt: null } });
      return true;
    },
    { timeout: 20_000 },
  );
}
