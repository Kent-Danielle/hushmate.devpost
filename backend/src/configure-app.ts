import type { INestApplication } from '@nestjs/common';
import { getConfig } from './config.js';

/** Shared by main.ts and the e2e tests, so both get the same app. */
export function configureApp(app: INestApplication): void {
  app.enableShutdownHooks();
  app.enableCors({
    origin: getConfig().frontendOrigins,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    exposedHeaders: ['Retry-After'],
    credentials: false,
  });
}
