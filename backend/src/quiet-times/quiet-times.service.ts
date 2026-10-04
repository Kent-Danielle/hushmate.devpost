import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { findOverlaps, type QuietRow } from '../common/quietTimeOverlap.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateQuietTimeDto } from './dto/create-quiet-time.dto.js';
import type { Scope, UpdateQuietTimeDto } from './dto/update-quiet-time.dto.js';

function checkMinutes(startMinute: number, endMinute: number): void {
  if (!CreateQuietTimeDto.stepOk(startMinute) || !CreateQuietTimeDto.stepOk(endMinute)) {
    throw new BadRequestException('Times must be in 15-minute steps');
  }
  if (startMinute === endMinute) throw new BadRequestException('Start and end must be different');
}

@Injectable()
export class QuietTimesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, houseId: string, dto: CreateQuietTimeDto): Promise<{ setId: string }> {
    checkMinutes(dto.startMinute, dto.endMinute);

    const membership = await this.prisma.membership.findUnique({
      where: { userId_houseId: { userId, houseId } },
      select: { status: true, setupDoneAt: true, user: { select: { activeHouseId: true } } },
    });
    if (!membership || membership.status !== 'approved') throw new ForbiddenException('You are not a member of this house');
    // Active house, or the setup step for a membership whose setup isn't done yet.
    if (membership.user.activeHouseId !== houseId && membership.setupDoneAt !== null) {
      throw new ForbiddenException('Quiet times can only be changed in your active house');
    }

    const existing = await this.prisma.quietTime.findMany({
      where: { userId, houseId },
      select: { dayOfWeek: true, startMinute: true, endMinute: true },
    });
    this.assertNoOverlap(dto, existing);

    const setId = randomUUID();
    await this.prisma.quietTime.createMany({
      data: dto.days.map((dayOfWeek) => ({
        userId,
        houseId,
        setId,
        dayOfWeek,
        startMinute: dto.startMinute,
        endMinute: dto.endMinute,
      })),
    });
    return { setId };
  }

  async update(userId: string, id: string, dto: UpdateQuietTimeDto): Promise<void> {
    checkMinutes(dto.startMinute, dto.endMinute);
    const row = await this.loadOwnedInActiveHouse(userId, id);

    const edited = await this.prisma.quietTime.findMany({
      where: dto.scope === 'set' ? { userId, houseId: row.houseId, setId: row.setId } : { id },
      select: { id: true, dayOfWeek: true },
    });
    const editedIds = edited.map((r) => r.id);
    const others = await this.prisma.quietTime.findMany({
      where: { userId, houseId: row.houseId, id: { notIn: editedIds } },
      select: { dayOfWeek: true, startMinute: true, endMinute: true },
    });
    this.assertNoOverlap({ days: edited.map((r) => r.dayOfWeek), ...dto }, others);

    await this.prisma.quietTime.updateMany({
      where: { id: { in: editedIds } },
      // "Just this day" splits the row out into its own set.
      data: {
        startMinute: dto.startMinute,
        endMinute: dto.endMinute,
        ...(dto.scope === 'day' ? { setId: randomUUID() } : {}),
      },
    });
  }

  async remove(userId: string, id: string, scope: Scope): Promise<void> {
    const row = await this.loadOwnedInActiveHouse(userId, id);
    await this.prisma.quietTime.deleteMany({
      where: scope === 'set' ? { userId, houseId: row.houseId, setId: row.setId } : { id },
    });
  }

  private assertNoOverlap(
    candidate: { days: number[]; startMinute: number; endMinute: number },
    others: QuietRow[],
  ): void {
    const conflicts = findOverlaps(candidate, others).map(({ dayOfWeek, startMinute, endMinute }) => ({
      dayOfWeek,
      startMinute,
      endMinute,
    }));
    if (conflicts.length > 0) throw new ConflictException({ statusCode: 409, message: 'overlap', conflicts });
  }

  /** Your own row, in your active house. Someone else's row looks like a missing one. */
  private async loadOwnedInActiveHouse(userId: string, id: string) {
    const row = await this.prisma.quietTime.findUnique({
      where: { id },
      select: { userId: true, houseId: true, setId: true, user: { select: { activeHouseId: true } } },
    });
    if (!row || row.userId !== userId) throw new NotFoundException('Quiet time not found');
    if (row.user.activeHouseId !== row.houseId) {
      throw new ForbiddenException('Quiet times can only be changed in your active house');
    }
    return row;
  }
}
