import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user.js';

/** Demo accounts can't create, join, activate or dismiss (the demo house is fixed). */
@Injectable()
export class DemoGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest<{ user?: AuthUser }>().user;
    if (user?.isDemo) throw new ForbiddenException('This is a demo account');
    return true;
  }
}
