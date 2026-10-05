import { Module } from '@nestjs/common';
import { DemoModule } from '../demo/demo.module.js';
import { SchedulerService } from './scheduler.service.js';

@Module({ imports: [DemoModule], providers: [SchedulerService], exports: [SchedulerService] })
export class SchedulerModule {}
