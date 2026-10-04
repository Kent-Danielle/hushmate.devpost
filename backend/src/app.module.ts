import { Module, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { HealthModule } from './health/health.module.js';
import { PrismaExceptionFilter } from './prisma-exception.filter.js';
import { PrismaModule } from './prisma/prisma.module.js';

// Later slices add here: AuthGuard (APP_GUARD), JwtModule, ThrottlerModule,
// ScheduleModule.forRoot (once, here only) and the feature modules.
@Module({
  imports: [PrismaModule, HealthModule],
  providers: [
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    },
    { provide: APP_FILTER, useClass: PrismaExceptionFilter },
  ],
})
export class AppModule {}
