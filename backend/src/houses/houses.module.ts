import { Module } from '@nestjs/common';
import { PushModule } from '../push/push.module.js';
import { HousesController } from './houses.controller.js';
import { HousesService } from './houses.service.js';
import { InvitesController } from './invites.controller.js';
import { InvitesService } from './invites.service.js';
import { MembershipsController } from './memberships.controller.js';
import { MembershipsService } from './memberships.service.js';

@Module({
  imports: [PushModule],
  controllers: [HousesController, MembershipsController, InvitesController],
  providers: [HousesService, MembershipsService, InvitesService],
  exports: [HousesService],
})
export class HousesModule {}
