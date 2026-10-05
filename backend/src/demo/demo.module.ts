import { Module } from '@nestjs/common';
import { NudgesModule } from '../nudges/nudges.module.js';
import { DemoService } from './demo.service.js';

@Module({ imports: [NudgesModule], providers: [DemoService], exports: [DemoService] })
export class DemoModule {}
