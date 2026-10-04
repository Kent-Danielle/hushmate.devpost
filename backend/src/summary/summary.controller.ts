import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { CreateHeadsUpDto } from './dto/create-heads-up.dto.js';
import { SummaryService } from './summary.service.js';

@Controller('houses')
export class SummaryController {
  constructor(private readonly summary: SummaryService) {}

  @Get(':id/summary')
  get(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 404 })) id: string) {
    return this.summary.get(user.id, id);
  }

  @Post(':id/heads-ups')
  async post(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 404 })) id: string,
    @Body() dto: CreateHeadsUpDto,
  ) {
    return { headsUp: await this.summary.postHeadsUp(user.id, id, dto.text, new Date(dto.at)) };
  }
}
