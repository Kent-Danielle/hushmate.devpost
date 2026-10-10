import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Public } from '../auth/public.decorator.js';
import { AssignDto } from './dto/assign.dto.js';
import { DemoService, type DemoAssignment } from './demo.service.js';

@Public()
@UseGuards(ThrottlerGuard)
@Controller('demo')
export class DemoController {
  constructor(private readonly demo: DemoService) {}

  @Post('assign')
  @HttpCode(200)
  assign(@Body() dto: AssignDto): Promise<DemoAssignment> {
    return this.demo.assign(dto.preferredEmail);
  }
}
