import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomMinutes } from '../common/random.js';
import { PrismaService } from '../prisma/prisma.service.js';

export const NUDGE_COOLDOWN_MS = 5 * 60 * 1000;

/** The `User` shape of the API contract. `demo` is set for demo accounts only. */
export interface UserShape {
  id: string;
  name: string;
  email: string;
  isDemo: boolean;
  activeHouseId: string | null;
  nudgeCooldownUntil: string | null;
  demo?: { houseName: string; botNames: string[] };
}

@Injectable()
export class MeService {
  constructor(private readonly prisma: PrismaService) {}

  async getUser(userId: string): Promise<UserShape> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, isDemo: true, activeHouseId: true },
    });
    if (!user) throw new UnauthorizedException();

    const lastNudge = await this.prisma.nudge.findFirst({
      where: { senderId: userId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    const until = lastNudge ? new Date(lastNudge.createdAt.getTime() + NUDGE_COOLDOWN_MS) : null;

    return {
      ...user,
      nudgeCooldownUntil: until && until.getTime() > Date.now() ? until.toISOString() : null,
      ...(user.isDemo ? { demo: await this.demoInfo(user.id) } : {}),
    };
  }

  /**
   * Demo accounts only: the house name and bot names (from the database, in seed order), and
   * arming of bot nudges. The conditional updateMany means concurrent opens can't overwrite each other.
   */
  private async demoInfo(userId: string): Promise<{ houseName: string; botNames: string[] }> {
    await this.prisma.user.updateMany({
      where: { id: userId, isDemo: true, demoNextNudgeAt: null },
      data: { demoNextNudgeAt: new Date(Date.now() + randomMinutes(1, 10) * 60_000) },
    });
    const house = await this.prisma.house.findFirst({
      where: { isDemo: true, memberships: { some: { userId, status: 'approved' } } },
      select: {
        name: true,
        memberships: {
          where: { status: 'approved', user: { isBot: true } },
          orderBy: { colorIndex: 'asc' },
          select: { user: { select: { name: true } } },
        },
      },
    });
    return { houseName: house?.name ?? '', botNames: house?.memberships.map((m) => m.user.name) ?? [] };
  }
}
