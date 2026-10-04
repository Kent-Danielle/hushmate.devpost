import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Public } from '../auth/public.decorator.js';
import { DemoGuard } from './demo.guard.js';
import { InvitesService } from './invites.service.js';

@Controller('invites')
export class InvitesController {
  constructor(private readonly invites: InvitesService) {}

  @Public()
  @Get(':token')
  lookup(@Param('token') token: string) {
    return this.invites.lookup(token);
  }

  @Post(':token/join')
  @UseGuards(DemoGuard)
  join(@CurrentUser() user: AuthUser, @Param('token') token: string) {
    return this.invites.join(user.id, token);
  }
}
