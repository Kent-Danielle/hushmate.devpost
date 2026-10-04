import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthUser } from '../auth/auth-user.js';
import { MeService, type UserShape } from './me.service.js';

@Controller('me')
export class MeController {
  constructor(private readonly me: MeService) {}

  @Get()
  get(@CurrentUser() user: AuthUser): Promise<UserShape> {
    return this.me.getUser(user.id);
  }
}
