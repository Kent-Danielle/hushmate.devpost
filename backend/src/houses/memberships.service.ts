import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { getConfig } from '../config.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PushService } from '../push/push.service.js';

const COLOR_COUNT = 5;

type Decision = 'approved' | 'declined';

@Injectable()
export class MembershipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
  ) {}

  /** Owner approves: colour by approved count, active if the requester has none, then the join-approved push. */
  async approve(ownerId: string, membershipId: string): Promise<{ status: Decision }> {
    const membership = await this.loadForOwner(ownerId, membershipId);
    if (membership.status === 'approved') return { status: 'approved' }; // double tap: no second push
    if (membership.status !== 'pending') throw new ConflictException('This request was already declined');

    const won = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.membership.updateMany({
        where: { id: membershipId, status: 'pending' },
        data: { status: 'approved', decidedAt: new Date() },
      });
      if (claimed.count === 0) return false;
      const approvedCount = await tx.membership.count({ where: { houseId: membership.houseId, status: 'approved' } });
      await tx.membership.update({
        where: { id: membershipId },
        data: { colorIndex: (approvedCount - 1) % COLOR_COUNT },
      });
      await tx.user.updateMany({
        where: { id: membership.userId, activeHouseId: null },
        data: { activeHouseId: membership.houseId },
      });
      return true;
    });

    if (won) {
      // sendToUser never throws; no subscription means nothing happens.
      await this.push.sendToUser(membership.userId, {
        kind: 'join-approved',
        body: `You're in! ${membership.house.name} approved your request.`,
        navigate: `${getConfig().appUrl.replace(/\/+$/, '')}/onboarding/setup/${membership.houseId}`,
      });
    }
    return { status: 'approved' };
  }

  async decline(ownerId: string, membershipId: string): Promise<{ status: Decision }> {
    const membership = await this.loadForOwner(ownerId, membershipId);
    if (membership.status === 'declined') return { status: 'declined' };
    if (membership.status !== 'pending') throw new ConflictException('This member was already approved');
    await this.prisma.membership.updateMany({
      where: { id: membershipId, status: 'pending' },
      data: { status: 'declined', decidedAt: new Date() },
    });
    return { status: 'declined' };
  }

  /** The requester dismisses their own declined card, which also lets them ask again. */
  async dismiss(userId: string, membershipId: string): Promise<void> {
    const membership = await this.prisma.membership.findUnique({
      where: { id: membershipId },
      select: { userId: true, status: true },
    });
    if (!membership) throw new NotFoundException('Request not found');
    if (membership.userId !== userId) throw new ForbiddenException('This is not your request');
    if (membership.status !== 'declined') throw new ForbiddenException('Only declined requests can be dismissed');
    await this.prisma.membership.deleteMany({ where: { id: membershipId, status: 'declined' } });
  }

  /** Your own approved membership: marks setup finished (or skipped). Idempotent. */
  async setupDone(userId: string, membershipId: string): Promise<void> {
    const membership = await this.prisma.membership.findUnique({
      where: { id: membershipId },
      select: { userId: true, status: true },
    });
    if (!membership) throw new NotFoundException('Membership not found');
    if (membership.userId !== userId) throw new ForbiddenException('This is not your membership');
    if (membership.status !== 'approved') throw new ForbiddenException('Setup is for approved memberships');
    await this.prisma.membership.updateMany({
      where: { id: membershipId, setupDoneAt: null },
      data: { setupDoneAt: new Date() },
    });
  }

  private async loadForOwner(ownerId: string, membershipId: string) {
    const membership = await this.prisma.membership.findUnique({
      where: { id: membershipId },
      select: { id: true, userId: true, houseId: true, status: true, house: { select: { name: true, ownerId: true } } },
    });
    if (!membership) throw new NotFoundException('Request not found');
    if (membership.house.ownerId !== ownerId) throw new ForbiddenException('Only the house owner can do this');
    return membership;
  }
}
