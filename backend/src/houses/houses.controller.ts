import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { CreateHouseDto } from './dto/create-house.dto.js';
import { DemoGuard } from './demo.guard.js';
import { HousesService, type HouseListItem, type HouseShape } from './houses.service.js';

const uuid = new ParseUUIDPipe({ errorHttpStatusCode: 404 });

@Controller('houses')
export class HousesController {
  constructor(private readonly houses: HousesService) {}

  @Post()
  @UseGuards(DemoGuard)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateHouseDto): Promise<{ house: HouseShape }> {
    return this.houses.create(user.id, dto.name);
  }

  @Get()
  list(@CurrentUser() user: AuthUser): Promise<HouseListItem[]> {
    return this.houses.list(user.id);
  }

  // Declared before the ':id' routes.
  @Get('lookup')
  lookup(@Query('id') id: string | undefined): Promise<HouseShape> {
    return this.houses.lookup(typeof id === 'string' ? id : '');
  }

  @Post(':id/join')
  @UseGuards(DemoGuard)
  join(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string) {
    return this.houses.join(user.id, id);
  }

  @Get(':id/requests')
  requests(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string) {
    return this.houses.requests(user.id, id);
  }

  @Post(':id/activate')
  @UseGuards(DemoGuard)
  activate(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string) {
    return this.houses.activate(user.id, id);
  }

  @Get(':id/invite-link')
  inviteLink(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string) {
    return this.houses.inviteLink(user.id, id);
  }

  @Get(':id/board')
  board(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string) {
    return this.houses.board(user.id, id);
  }
}
