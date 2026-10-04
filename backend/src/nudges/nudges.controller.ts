import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { CreateNudgeDto } from './dto/create-nudge.dto.js';
import { NudgesService } from './nudges.service.js';

@Controller('nudges')
export class NudgesController {
  constructor(private readonly nudges: NudgesService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateNudgeDto) {
    return this.nudges.send(user.id, dto.recipientId);
  }

  @Get('pending')
  pending(@CurrentUser() user: AuthUser) {
    return this.nudges.pending(user.id);
  }

  @Post('acknowledge')
  @HttpCode(200)
  acknowledge(@CurrentUser() user: AuthUser) {
    return this.nudges.acknowledge(user.id);
  }
}
