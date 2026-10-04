import { Module } from '@nestjs/common';
import { PushModule } from '../push/push.module.js';
import { NudgesController } from './nudges.controller.js';
import { NudgesService } from './nudges.service.js';

@Module({
  imports: [PushModule],
  controllers: [NudgesController],
  providers: [NudgesService],
  exports: [NudgesService],
})
export class NudgesModule {}
