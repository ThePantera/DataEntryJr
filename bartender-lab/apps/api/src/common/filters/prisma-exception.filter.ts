import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

const STATUS_BY_CODE: Record<string, { status: HttpStatus; message: string }> = {
  P2000: { status: HttpStatus.BAD_REQUEST, message: 'A value is too long for its field' },
  P2002: {
    status: HttpStatus.CONFLICT,
    message: 'A resource with the same unique value already exists',
  },
  P2003: {
    status: HttpStatus.CONFLICT,
    message: 'The operation violates a reference between resources',
  },
  P2025: { status: HttpStatus.NOT_FOUND, message: 'Resource not found' },
};

/** Maps known Prisma errors to HTTP responses without leaking queries or values. */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const mapped = STATUS_BY_CODE[exception.code];
    if (!mapped) {
      this.logger.error(`Unhandled database error ${exception.code}`);
      response
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Internal server error' });
      return;
    }
    response.status(mapped.status).json({ statusCode: mapped.status, message: mapped.message });
  }
}
