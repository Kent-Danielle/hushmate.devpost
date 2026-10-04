import { Controller, Delete, HttpCode, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { DemoGuard } from './demo.guard.js';
import { MembershipsService } from './memberships.service.js';

const uuid = new ParseUUIDPipe({ errorHttpStatusCode: 404 });

@Controller('memberships')
export class MembershipsController {
  constructor(private readonly memberships: MembershipsService) {}

  @Post(':id/approve')
  @HttpCode(200)
  approve(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string) {
    return this.memberships.approve(user.id, id);
  }

  @Post(':id/decline')
  @HttpCode(200)
  decline(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string) {
    return this.memberships.decline(user.id, id);
  }

  @Post(':id/setup-done')
  @HttpCode(204)
  async setupDone(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string): Promise<void> {
    await this.memberships.setupDone(user.id, id);
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(DemoGuard)
  async dismiss(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string): Promise<void> {
    await this.memberships.dismiss(user.id, id);
  }
}
