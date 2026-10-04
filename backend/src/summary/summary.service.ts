import { Injectable } from '@nestjs/common';
import { vancouverDaysBetween } from '../common/vancouverTime.js';
import { HousesService } from '../houses/houses.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

const DEMO_STREAK = 10;
const ACK_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface SummaryShape {
  streakDays: number;
  isDemo: boolean;
  headsUps: { id: string; text: string; at: Date; authorName: string }[];
  myAcks: { nudgeId: string; recipientName: string; acknowledgedAt: Date }[];
}

@Injectable()
export class SummaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly houses: HousesService,
  ) {}

  async get(userId: string, houseId: string): Promise<SummaryShape> {
    await this.houses.requireApprovedMember(userId, houseId);
    const now = new Date();
    const [house, lastNudge, headsUps, acks] = await Promise.all([
      this.prisma.house.findUniqueOrThrow({ where: { id: houseId }, select: { isDemo: true, createdAt: true } }),
      this.prisma.nudge.findFirst({ where: { houseId }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
      this.prisma.headsUp.findMany({
        where: { houseId, at: { gt: now } },
        orderBy: { at: 'asc' },
        select: { id: true, text: true, at: true, author: { select: { name: true } } },
      }),
      this.prisma.nudge.findMany({
        where: { houseId, senderId: userId, acknowledgedAt: { gt: new Date(now.getTime() - ACK_WINDOW_MS) } },
        orderBy: { acknowledgedAt: 'desc' },
        select: { id: true, acknowledgedAt: true, recipient: { select: { name: true } } },
      }),
    ]);

    return {
      streakDays: house.isDemo ? DEMO_STREAK : vancouverDaysBetween(lastNudge?.createdAt ?? house.createdAt, now),
      isDemo: house.isDemo,
      headsUps: headsUps.map((h) => ({ id: h.id, text: h.text, at: h.at, authorName: h.author.name })),
      myAcks: acks.map((a) => ({ nudgeId: a.id, recipientName: a.recipient.name, acknowledgedAt: a.acknowledgedAt! })),
    };
  }
}
