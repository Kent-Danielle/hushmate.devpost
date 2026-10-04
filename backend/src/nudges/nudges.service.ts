import { ForbiddenException, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { getConfig } from '../config.js';
import { NUDGE_COOLDOWN_MS } from '../me/me.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PushService } from '../push/push.service.js';
import { DEMO_SUBTITLE, NUDGE_MESSAGES, messageFor, pushBody } from './messages.js';

export interface CreateAndSendInput {
  houseId: string;
  senderId: string;
  recipientId: string;
  isDemo?: boolean;
  /** Bots (slice 7) skip the per-sender cooldown. */
  skipCooldown?: boolean;
}

export interface PendingNudge {
  id: string;
  message: string;
  subtitle: string | null;
  isDemo: boolean;
  createdAt: Date;
}

@Injectable()
export class NudgesService {
  private readonly logger = new Logger(NudgesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
  ) {}

  /** Cooldown check, insert, then a non-awaited push. Returns the sender's next-allowed time. */
  async createAndSend(input: CreateAndSendInput): Promise<{ cooldownUntil: string }> {
    const now = Date.now();
    if (!input.skipCooldown) {
      const last = await this.prisma.nudge.findFirst({
        where: { senderId: input.senderId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });
      const until = last ? last.createdAt.getTime() + NUDGE_COOLDOWN_MS : 0;
      if (until > now) {
        throw new HttpException(
          { statusCode: 429, message: 'Nudge again in a few minutes', error: 'Too Many Requests', cooldownUntil: new Date(until).toISOString() },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    const isDemo = input.isDemo ?? false;
    const messageIndex = randomInt(0, NUDGE_MESSAGES.length);
    const nudge = await this.prisma.nudge.create({
      data: { houseId: input.houseId, senderId: input.senderId, recipientId: input.recipientId, messageIndex, isDemo },
      select: { createdAt: true },
    });

    // After the insert commits; never awaited, never throws. No sender info goes into the payload or logs.
    void this.push
      .sendToUser(input.recipientId, {
        kind: 'nudge',
        body: pushBody(messageIndex, isDemo),
        navigate: `${getConfig().appUrl.replace(/\/+$/, '')}/schedule`,
      })
      .catch((error: unknown) => this.logger.warn(`Nudge push failed: ${error instanceof Error ? error.message : 'unknown'}`));

    return { cooldownUntil: new Date(nudge.createdAt.getTime() + NUDGE_COOLDOWN_MS).toISOString() };
  }

  /** Sender and recipient must share the same active house, both approved there, and be different people. */
  async send(senderId: string, recipientId: string): Promise<{ cooldownUntil: string }> {
    if (senderId === recipientId) throw new ForbiddenException('You cannot nudge yourself');
    const users = await this.prisma.user.findMany({
      where: { id: { in: [senderId, recipientId] } },
      select: { id: true, activeHouseId: true },
    });
    const sender = users.find((u) => u.id === senderId);
    const recipient = users.find((u) => u.id === recipientId);
    const houseId = sender?.activeHouseId;
    if (!houseId || !recipient || recipient.activeHouseId !== houseId) {
      throw new ForbiddenException('You can only nudge housemates in your active house');
    }
    const approved = await this.prisma.membership.count({
      where: { houseId, userId: { in: [senderId, recipientId] }, status: 'approved' },
    });
    if (approved !== 2) throw new ForbiddenException('You can only nudge housemates in your active house');
    const house = await this.prisma.house.findUnique({ where: { id: houseId }, select: { isDemo: true } });
    return this.createAndSend({ houseId, senderId, recipientId, isDemo: house?.isDemo ?? false });
  }

  /** My unacknowledged nudges, oldest first. The sender is never selected. */
  async pending(userId: string): Promise<PendingNudge[]> {
    const rows = await this.prisma.nudge.findMany({
      where: { recipientId: userId, acknowledgedAt: null },
      orderBy: { createdAt: 'asc' },
      select: { id: true, messageIndex: true, isDemo: true, createdAt: true },
    });
    return rows.map((r) => ({
      id: r.id,
      message: messageFor(r.messageIndex),
      subtitle: r.isDemo ? DEMO_SUBTITLE : null,
      isDemo: r.isDemo,
      createdAt: r.createdAt,
    }));
  }

  async acknowledge(userId: string): Promise<{ acknowledged: number }> {
    const result = await this.prisma.nudge.updateMany({
      where: { recipientId: userId, acknowledgedAt: null },
      data: { acknowledgedAt: new Date() },
    });
    return { acknowledged: result.count };
  }
}
