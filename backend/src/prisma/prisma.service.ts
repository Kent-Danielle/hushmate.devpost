import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { getConfig } from '../config.js';

@Injectable()
export class PrismaService extends PrismaClient implements OnApplicationShutdown {
  constructor() {
    // SSL comes only from the URL: ?sslmode=no-verify in production, none locally.
    super({
      adapter: new PrismaPg({
        connectionString: getConfig().databaseUrl,
        max: 5,
        idleTimeoutMillis: 60_000,
        connectionTimeoutMillis: 10_000,
        keepAlive: true,
        statement_timeout: 15_000,
        query_timeout: 15_000,
      }),
    });
  }

  // Runs after the timers stop (see the scheduler's onModuleDestroy).
  async onApplicationShutdown(): Promise<void> {
    await this.$disconnect();
  }
}
