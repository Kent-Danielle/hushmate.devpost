import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export const NUDGE_COOLDOWN_MS = 5 * 60 * 1000;

/** The `User` shape of the API contract. `demo` arrives with the demo slice. */
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
    };
  }
}
