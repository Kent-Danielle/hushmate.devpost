import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthService, type AuthResult } from './auth.service.js';
import { SignInDto } from './dto/signin.dto.js';
import { SignUpDto } from './dto/signup.dto.js';
import { Public } from './public.decorator.js';

@Public()
@UseGuards(ThrottlerGuard)
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('signup')
  signUp(@Body() dto: SignUpDto): Promise<AuthResult> {
    return this.auth.signUp(dto);
  }

  @Post('signin')
  @HttpCode(200)
  signIn(@Body() dto: SignInDto): Promise<AuthResult> {
    return this.auth.signIn(dto);
  }
}
