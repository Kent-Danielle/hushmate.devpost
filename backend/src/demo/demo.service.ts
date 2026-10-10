import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { Prisma } from '../generated/prisma/client.js';
import { getConfig } from '../config.js';
import { latestVancouver3am } from '../common/vancouverTime.js';
import { randomMinutes } from '../common/random.js';
import { NudgesService } from '../nudges/nudges.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { DEMO_HOUSE_CODE, DEMO_HOUSE_NAME, DEMO_JUDGES, LAST_DEMO_RESET_KEY, resetDemoContent } from './demo-data.js';

const MIN = 60_000;
/** A bot taps "Got it" this long after it was nudged. */
export const BOT_ACK_DELAY_MS = 10_000;

export interface DemoAssignment {
  email: string;
  password: string;
}

@Injectable()
export class DemoService {
  private readonly logger = new Logger(DemoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly nudges: NudgesService,
  ) {}

  /**
   * Hand out a demo login. A preferred demo account (isDemo, not a bot, has a password) is
   * returned again; otherwise the least recently assigned one. The pick and the stamp are one
   * statement with SKIP LOCKED, so concurrent requests can't get the same account.
   */
  async assign(preferredEmail?: string): Promise<DemoAssignment> {
    const password = getConfig().demoAccountPassword;
    const judgeEmails = DEMO_JUDGES.map((j) => j.email);
    if (!password) throw this.unavailable();

    if (preferredEmail) {
      const preferred = await this.prisma.user.updateManyAndReturn({
        where: { email: preferredEmail, AND: { email: { in: judgeEmails } }, isDemo: true, isBot: false, passwordHash: { not: null } },
        data: { demoAssignedAt: new Date() },
        select: { email: true },
      });
      if (preferred[0]) return { email: preferred[0].email, password };
    }

    const picked = await this.prisma.$queryRaw<{ email: string }[]>`
      UPDATE users SET "demoAssignedAt" = now()
      WHERE id = (
        SELECT id FROM users
        WHERE "isDemo" AND NOT "isBot" AND "passwordHash" IS NOT NULL
          AND email IN (${Prisma.join(judgeEmails)})
        ORDER BY "demoAssignedAt" ASC NULLS FIRST, random()
        LIMIT 1
        FOR UPDATE SKIP LOCKED)
      RETURNING email`;
    if (!picked[0]) throw this.unavailable();
    return { email: picked[0].email, password };
  }

  private unavailable(): ServiceUnavailableException {
    return new ServiceUnavailableException("The demo isn't available right now");
  }

  /** Run the nightly reset. Guarded in the database, so it's a no-op (false) when already done since the latest 03:00. */
  reset(now: Date = new Date()): Promise<boolean> {
    return resetDemoContent(this.prisma, now);
  }

  /** The catch-up check: reset only when lastDemoResetAt is before the latest 03:00 Vancouver. */
  async resetIfOverdue(now: Date = new Date()): Promise<boolean> {
    const state = await this.prisma.systemState.findUnique({ where: { key: LAST_DEMO_RESET_KEY } });
    if (state && state.value >= latestVancouver3am(now)) return false;
    const ran = await this.reset(now);
    if (ran) this.logger.log('Demo house reset');
    return ran;
  }

  /**
   * Claim, then send, for each demo user whose nudge is due: a conditional updateMany moves
   * demoNextNudgeAt forward by 5-10 minutes, and only the winner sends (at most once).
   */
  async sendDueBotNudges(now: Date = new Date()): Promise<number> {
    const due = await this.prisma.user.findMany({
      where: { isDemo: true, demoNextNudgeAt: { lte: now } },
      select: { id: true, activeHouseId: true },
    });
    if (due.length === 0) return 0;
    const house = await this.prisma.house.findFirst({
      where: { isDemo: true, code: DEMO_HOUSE_CODE, name: DEMO_HOUSE_NAME },
      select: { id: true },
    });
    const bots = await this.prisma.user.findMany({
      where: { isBot: true, memberships: { some: { houseId: house?.id ?? '', status: 'approved' } } },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });

    let sent = 0;
    for (const user of due) {
      const claim = await this.prisma.user.updateMany({
        where: { id: user.id, demoNextNudgeAt: { lte: now } },
        data: { demoNextNudgeAt: new Date(now.getTime() + randomMinutes(5, 10) * MIN) },
      });
      if (claim.count !== 1 || !house || bots.length === 0) continue;
      try {
        await this.nudges.createAndSend({
          houseId: house.id,
          senderId: bots[randomInt(0, bots.length)]!.id,
          recipientId: user.id,
          isDemo: true,
          skipCooldown: true,
        });
        sent += 1;
      } catch (error) {
        this.logger.warn(`Demo nudge failed: ${error instanceof Error ? error.message : 'unknown'}`);
      }
    }
    return sent;
  }

  /** Bots tap "Got it" about 10 seconds after they're nudged. */
  async acknowledgeBotNudges(now: Date = new Date()): Promise<number> {
    const result = await this.prisma.nudge.updateMany({
      where: {
        acknowledgedAt: null,
        createdAt: { lte: new Date(now.getTime() - BOT_ACK_DELAY_MS) },
        recipient: { isBot: true },
      },
      data: { acknowledgedAt: now },
    });
    return result.count;
  }

  /** Heartbeat: a visible "scheduler alive" timestamp, and a belt-and-braces activity signal. */
  async heartbeat(now: Date = new Date()): Promise<void> {
    await this.prisma.systemState.upsert({
      where: { key: 'heartbeatAt' },
      create: { key: 'heartbeatAt', value: now },
      update: { value: now },
    });
  }
}
