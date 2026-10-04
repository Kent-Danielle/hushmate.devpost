import { Module } from '@nestjs/common';
import { QuietTimesController } from './quiet-times.controller.js';
import { QuietTimesService } from './quiet-times.service.js';

@Module({
  controllers: [QuietTimesController],
  providers: [QuietTimesService],
})
export class QuietTimesModule {}
