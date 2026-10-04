import { Body, Controller, Delete, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { CreateQuietTimeDto } from './dto/create-quiet-time.dto.js';
import { DeleteQuietTimeQuery } from './dto/delete-quiet-time.query.js';
import { UpdateQuietTimeDto } from './dto/update-quiet-time.dto.js';
import { QuietTimesService } from './quiet-times.service.js';

const uuid = new ParseUUIDPipe({ errorHttpStatusCode: 404 });

// No DemoGuard here: demo users may add, edit and delete quiet times.
@Controller()
export class QuietTimesController {
  constructor(private readonly quietTimes: QuietTimesService) {}

  @Post('houses/:id/quiet-times')
  create(@CurrentUser() user: AuthUser, @Param('id', uuid) houseId: string, @Body() dto: CreateQuietTimeDto) {
    return this.quietTimes.create(user.id, houseId, dto);
  }

  @Patch('quiet-times/:id')
  @HttpCode(200)
  async update(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string, @Body() dto: UpdateQuietTimeDto) {
    await this.quietTimes.update(user.id, id, dto);
    return {};
  }

  @Delete('quiet-times/:id')
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string, @Query() query: DeleteQuietTimeQuery) {
    await this.quietTimes.remove(user.id, id, query.scope ?? 'day');
  }
}
