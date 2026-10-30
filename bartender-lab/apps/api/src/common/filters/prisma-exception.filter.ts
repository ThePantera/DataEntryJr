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

type PrismaError =
  | Prisma.PrismaClientKnownRequestError
  | Prisma.PrismaClientValidationError
  | Prisma.PrismaClientUnknownRequestError;

/**
 * Maps Prisma errors to HTTP responses. Prisma error messages can embed query arguments and
 * Postgres "failing row" details (e.g. a password hash), so they are never sent to the client
 * nor written to the logs: only the error class and code are logged.
 */
@Catch(
  Prisma.PrismaClientKnownRequestError,
  Prisma.PrismaClientValidationError,
  Prisma.PrismaClientUnknownRequestError,
)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: PrismaError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const code =
      exception instanceof Prisma.PrismaClientKnownRequestError ? exception.code : undefined;
    const mapped = code ? STATUS_BY_CODE[code] : undefined;
    if (mapped) {
      response.status(mapped.status).json({ statusCode: mapped.status, message: mapped.message });
      return;
    }

    this.logger.error(`Unhandled database error: ${exception.name}${code ? ` ${code}` : ''}`);
    response
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json({ statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Internal server error' });
  }
}
