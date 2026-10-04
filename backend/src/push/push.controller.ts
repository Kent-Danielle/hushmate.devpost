import { Body, Controller, Delete, Get, HttpCode, Post } from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Public } from '../auth/public.decorator.js';
import { SubscribeDto, UnsubscribeDto } from './dto/subscription.dto.js';
import { PushService } from './push.service.js';

@Controller('push')
export class PushController {
  constructor(private readonly push: PushService) {}

  @Public()
  @Get('vapid-public-key')
  vapidPublicKey(): { key: string } {
    return { key: this.push.getPublicKey() };
  }

  @Post('subscriptions')
  async subscribe(@CurrentUser() user: AuthUser, @Body() dto: SubscribeDto): Promise<void> {
    await this.push.subscribe(user.id, dto);
  }

  @Delete('subscriptions')
  @HttpCode(204)
  async unsubscribe(@CurrentUser() user: AuthUser, @Body() dto: UnsubscribeDto): Promise<void> {
    await this.push.unsubscribe(user.id, dto.endpoint);
  }
}
