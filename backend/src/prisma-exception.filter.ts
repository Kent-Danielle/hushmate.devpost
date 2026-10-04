import { ArgumentsHost, Catch, ConflictException } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from './generated/prisma/client.js';

/** Maps Prisma P2002 (unique violation) to 409; everything else keeps Nest's defaults. */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter extends BaseExceptionFilter {
  override catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost): void {
    if (exception.code === 'P2002') {
      super.catch(new ConflictException('Already exists'), host);
      return;
    }
    super.catch(exception, host);
  }
}
