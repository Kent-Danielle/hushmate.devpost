import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from '../auth/public.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
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
