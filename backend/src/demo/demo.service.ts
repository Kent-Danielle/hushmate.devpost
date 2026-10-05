import { Injectable, Logger } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { latestVancouver3am } from '../common/vancouverTime.js';
import { randomMinutes } from '../common/random.js';
import { NudgesService } from '../nudges/nudges.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { DEMO_HOUSE_CODE, DEMO_HOUSE_NAME, LAST_DEMO_RESET_KEY, resetDemoContent } from './demo-data.js';

const MIN = 60_000;
/** A bot taps "Got it" this long after it was nudged. */
export const BOT_ACK_DELAY_MS = 60_000;

@Injectable()
export class DemoService {
  private readonly logger = new Logger(DemoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly nudges: NudgesService,
  ) {}

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
   * demoNextNudgeAt forward by 30-120 minutes, and only the winner sends (at most once).
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
        data: { demoNextNudgeAt: new Date(now.getTime() + randomMinutes(30, 120) * MIN) },
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

  /** Bots tap "Got it" about a minute after they're nudged. */
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
