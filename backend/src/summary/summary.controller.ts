import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { SummaryService } from './summary.service.js';

@Controller('houses')
export class SummaryController {
  constructor(private readonly summary: SummaryService) {}

  @Get(':id/summary')
  get(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 404 })) id: string) {
    return this.summary.get(user.id, id);
  }
}
