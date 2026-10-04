import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthUser } from './auth-user.js';

/** The user AuthGuard attached to the request. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest<{ user: AuthUser }>().user;
});
