import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthUser } from './auth-user.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';

interface AuthedRequest {
  headers: Record<string, string | string[] | undefined>;
  user?: AuthUser;
}

/** Global guard: Bearer JWT (HS256) -> user row -> request.user. Every failure is a 401. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const header = request.headers.authorization;
    const [scheme, token] = typeof header === 'string' ? header.split(' ') : [];
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException();

    let sub: unknown;
    try {
      const payload = await this.jwt.verifyAsync<{ sub?: unknown }>(token, { algorithms: ['HS256'] });
      sub = payload.sub;
    } catch {
      throw new UnauthorizedException();
    }
    if (typeof sub !== 'string' || !UUID.test(sub)) throw new UnauthorizedException();

    const user = await this.prisma.user.findUnique({
      where: { id: sub },
      select: { id: true, isDemo: true, isBot: true, activeHouseId: true },
    });
    if (!user || user.isBot) throw new UnauthorizedException();

    request.user = { id: user.id, isDemo: user.isDemo, activeHouseId: user.activeHouseId };
    return true;
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
