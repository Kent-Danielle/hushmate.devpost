import { Module } from '@nestjs/common';
import { MeModule } from '../me/me.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

@Module({ imports: [MeModule], controllers: [AuthController], providers: [AuthService] })
export class AuthModule {}
