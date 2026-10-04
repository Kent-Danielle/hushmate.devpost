import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { vancouverDaysBetween } from '../common/vancouverTime.js';
import { HousesService } from '../houses/houses.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

const DEMO_STREAK = 10;
const ACK_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface HeadsUpShape {
  id: string;
  text: string;
  at: Date;
  authorName: string;
}

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

  /** Posts a heads-up to the user's active house. `at` must be in the future. */
  async postHeadsUp(userId: string, houseId: string, text: string, at: Date): Promise<HeadsUpShape> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { name: true, activeHouseId: true } });
    if (!user || user.activeHouseId !== houseId) throw new ForbiddenException('This is not your active house');
    await this.houses.requireApprovedMember(userId, houseId);
    if (!(at.getTime() > Date.now())) throw new BadRequestException('at must be in the future');
    const created = await this.prisma.headsUp.create({ data: { houseId, authorId: userId, text, at } });
    return { id: created.id, text: created.text, at: created.at, authorName: user.name };
  }
}
