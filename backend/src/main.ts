import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './configure-app.js';
import { getConfig } from './config.js';
import { SchedulerService } from './scheduler/scheduler.service.js';

async function bootstrap(): Promise<void> {
  const config = getConfig(); // fails fast on missing env
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  await app.listen(config.port, '0.0.0.0');
  await app.get(SchedulerService).runBootChecks();
}

void bootstrap();
