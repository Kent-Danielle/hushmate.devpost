import { Module } from '@nestjs/common';
import { NudgesModule } from '../nudges/nudges.module.js';
import { DemoController } from './demo.controller.js';
import { DemoService } from './demo.service.js';

@Module({ imports: [NudgesModule], controllers: [DemoController], providers: [DemoService], exports: [DemoService] })
export class DemoModule {}
