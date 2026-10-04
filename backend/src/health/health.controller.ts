import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  // Public. When AuthGuard arrives (slice 2), mark this route @Public().
  @Get()
  async check(): Promise<{ ok: true; db: true }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({ ok: false, db: false });
    }
    return { ok: true, db: true };
  }
}
