import { Module, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthGuard } from './auth/auth.guard.js';
import { AuthModule } from './auth/auth.module.js';
import { getConfig } from './config.js';
import { HealthModule } from './health/health.module.js';
import { HousesModule } from './houses/houses.module.js';
import { MeModule } from './me/me.module.js';
import { NudgesModule } from './nudges/nudges.module.js';
import { PrismaExceptionFilter } from './prisma-exception.filter.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { PushModule } from './push/push.module.js';
import { QuietTimesModule } from './quiet-times/quiet-times.module.js';
import { SchedulerModule } from './scheduler/scheduler.module.js';
import { SummaryModule } from './summary/summary.module.js';

@Module({
  imports: [
    PrismaModule,
    // Imported once, here only: a second forRoot() would register every job twice.
    ScheduleModule.forRoot({ cronJobs: process.env.SCHEDULER_ENABLED !== 'false' }),
    JwtModule.registerAsync({
      global: true,
      useFactory: () => ({
        secret: getConfig().jwtSecret,
        signOptions: { algorithm: 'HS256', expiresIn: '30d' },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
    // Applied only where @UseGuards(ThrottlerGuard) is used (AuthController): 5 a minute per client IP.
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 5 }],
      // Fly's edge sets Fly-Client-IP; locally there's no proxy, so use the socket IP.
      getTracker: (req) => {
        const header = req.headers?.['fly-client-ip'];
        return (typeof header === 'string' && header.trim()) || (req.ip as string | undefined) || 'unknown';
      },
      errorMessage: 'Too many attempts. Try again in a minute.',
    }),
    HealthModule,
    AuthModule,
    MeModule,
    PushModule,
    HousesModule,
    QuietTimesModule,
    NudgesModule,
    SummaryModule,
    SchedulerModule,
  ],
  providers: [
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    },
    { provide: APP_FILTER, useClass: PrismaExceptionFilter },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
