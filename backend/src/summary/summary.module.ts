import { Module } from '@nestjs/common';
import { HousesModule } from '../houses/houses.module.js';
import { SummaryController } from './summary.controller.js';
import { SummaryService } from './summary.service.js';

@Module({ imports: [HousesModule], controllers: [SummaryController], providers: [SummaryService] })
export class SummaryModule {}
