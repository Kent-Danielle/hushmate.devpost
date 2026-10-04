import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { getConfig } from '../config.js';
import { randomCode, randomInviteToken } from '../common/random.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface HouseShape {
  id: string;
  name: string;
  code: string;
}

export interface HouseListItem {
  membershipId: string;
  status: 'pending' | 'approved' | 'declined';
  house: HouseShape;
  isActive: boolean;
  isOwner: boolean;
  pendingCount: number;
  setupDone: boolean;
}

export interface BoardShape {
  members: { id: string; name: string; colorIndex: number; isAway: boolean; isYou: boolean }[];
  quietTimes: { id: string; userId: string; setId: string; dayOfWeek: number; startMinute: number; endMinute: number }[];
}

const MAX_CODE_ATTEMPTS = 8;

@Injectable()
export class HousesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Creates a house with a unique (nameKey, code), the owner's approved membership, and activates it if the user has none. */
  async create(userId: string, name: string): Promise<{ house: HouseShape }> {
    const nameKey = name.toLowerCase();
    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
      try {
        const house = await this.prisma.$transaction(async (tx) => {
          const created = await tx.house.create({
            data: { name, nameKey, code: randomCode(), inviteToken: randomInviteToken(), ownerId: userId },
          });
          await tx.membership.create({
            data: { userId, houseId: created.id, status: 'approved', colorIndex: 0, decidedAt: new Date() },
          });
          await tx.user.updateMany({ where: { id: userId, activeHouseId: null }, data: { activeHouseId: created.id } });
          return created;
        });
        return { house: { id: house.id, name: house.name, code: house.code } };
      } catch (error) {
        // A (nameKey, code) collision: try another code. Anything else is a real error.
        if (isUniqueViolation(error) && attempt < MAX_CODE_ATTEMPTS - 1) continue;
        throw error;
      }
    }
    throw new ConflictException('Could not create the house. Try again.');
  }

  async list(userId: string): Promise<HouseListItem[]> {
    const [user, memberships] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { activeHouseId: true } }),
      this.prisma.membership.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
        include: { house: { select: { id: true, name: true, code: true, ownerId: true } } },
      }),
    ]);
    const ownedIds = memberships.filter((m) => m.house.ownerId === userId).map((m) => m.houseId);
    const pending = ownedIds.length
      ? await this.prisma.membership.groupBy({
          by: ['houseId'],
          where: { houseId: { in: ownedIds }, status: 'pending' },
          _count: { _all: true },
        })
      : [];
    const pendingByHouse = new Map(pending.map((p) => [p.houseId, p._count._all]));

    return memberships.map((m) => ({
      membershipId: m.id,
      status: m.status,
      house: { id: m.house.id, name: m.house.name, code: m.house.code },
      isActive: user?.activeHouseId === m.houseId,
      isOwner: m.house.ownerId === userId,
      pendingCount: pendingByHouse.get(m.houseId) ?? 0,
      setupDone: m.setupDoneAt !== null,
    }));
  }

  /** `Name#123456`: split on the LAST '#', match the name case-insensitively. */
  async lookup(id: string): Promise<HouseShape> {
    const hash = id.lastIndexOf('#');
    if (hash < 1) throw new NotFoundException('House not found');
    const nameKey = id.slice(0, hash).trim().toLowerCase();
    const code = id.slice(hash + 1).trim();
    if (!nameKey || !/^\d{6}$/.test(code)) throw new NotFoundException('House not found');
    const house = await this.prisma.house.findUnique({
      where: { nameKey_code: { nameKey, code } },
      select: { id: true, name: true, code: true },
    });
    if (!house) throw new NotFoundException('House not found');
    return house;
  }

  /** Creates a pending membership. 404 unknown house, 403 demo house, 409 already a member or pending. */
  async join(userId: string, houseId: string): Promise<{ membershipId: string; status: 'pending' }> {
    const house = await this.prisma.house.findUnique({ where: { id: houseId }, select: { id: true, isDemo: true } });
    if (!house) throw new NotFoundException('House not found');
    if (house.isDemo) throw new ForbiddenException('This is a demo house');
    const existing = await this.prisma.membership.findUnique({
      where: { userId_houseId: { userId, houseId } },
      select: { id: true },
    });
    if (existing) throw new ConflictException('You already belong to this house or have a request waiting');
    // A concurrent double-tap loses to the unique (userId, houseId) index: P2002 -> 409 by the global filter.
    const membership = await this.prisma.membership.create({ data: { userId, houseId }, select: { id: true } });
    return { membershipId: membership.id, status: 'pending' };
  }

  async activate(userId: string, houseId: string): Promise<{ activeHouseId: string }> {
    await this.requireApprovedMember(userId, houseId);
    await this.prisma.user.update({ where: { id: userId }, data: { activeHouseId: houseId } });
    return { activeHouseId: houseId };
  }

  async inviteLink(userId: string, houseId: string): Promise<{ url: string }> {
    await this.requireApprovedMember(userId, houseId);
    const house = await this.prisma.house.findUnique({ where: { id: houseId }, select: { inviteToken: true } });
    if (!house) throw new NotFoundException('House not found');
    return { url: `${getConfig().appUrl.replace(/\/+$/, '')}/join/${house.inviteToken}` };
  }

  /** Pending requests, oldest first. Owner only. */
  async requests(userId: string, houseId: string): Promise<{ membershipId: string; name: string; createdAt: Date }[]> {
    const house = await this.prisma.house.findUnique({ where: { id: houseId }, select: { ownerId: true } });
    if (!house) throw new NotFoundException('House not found');
    if (house.ownerId !== userId) throw new ForbiddenException('Only the house owner can see requests');
    const rows = await this.prisma.membership.findMany({
      where: { houseId, status: 'pending' },
      orderBy: { createdAt: 'asc' },
      select: { id: true, createdAt: true, user: { select: { name: true } } },
    });
    return rows.map((r) => ({ membershipId: r.id, name: r.user.name, createdAt: r.createdAt }));
  }

  /** Approved members (no emails, no bot flags) and all their quiet times in this house. Approved members only. */
  async board(userId: string, houseId: string): Promise<BoardShape> {
    await this.requireApprovedMember(userId, houseId);
    const [memberships, quietTimes] = await Promise.all([
      this.prisma.membership.findMany({
        where: { houseId, status: 'approved' },
        orderBy: { createdAt: 'asc' },
        select: { colorIndex: true, user: { select: { id: true, name: true, activeHouseId: true } } },
      }),
      this.prisma.quietTime.findMany({
        where: { houseId },
        orderBy: [{ dayOfWeek: 'asc' }, { startMinute: 'asc' }],
        select: { id: true, userId: true, setId: true, dayOfWeek: true, startMinute: true, endMinute: true },
      }),
    ]);
    return {
      members: memberships.map((m) => ({
        id: m.user.id,
        name: m.user.name,
        colorIndex: m.colorIndex ?? 0,
        isAway: m.user.activeHouseId !== houseId,
        isYou: m.user.id === userId,
      })),
      quietTimes,
    };
  }

  /** 403 unless the user has an approved membership in the house (also covers unknown houses). */
  async requireApprovedMember(userId: string, houseId: string): Promise<void> {
    const membership = await this.prisma.membership.findUnique({
      where: { userId_houseId: { userId, houseId } },
      select: { status: true },
    });
    if (membership?.status !== 'approved') throw new ForbiddenException('You are not a member of this house');
  }

  async findByInviteToken(token: string): Promise<{ id: string; name: string; code: string } | null> {
    return this.prisma.house.findUnique({ where: { inviteToken: token }, select: { id: true, name: true, code: true } });
  }
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
