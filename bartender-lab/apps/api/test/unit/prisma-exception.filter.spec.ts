import type { ArgumentsHost } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaExceptionFilter } from '../../src/common/filters/prisma-exception.filter';

function fakeHost() {
  const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const host = {
    switchToHttp: () => ({ getResponse: () => response }),
  } as unknown as ArgumentsHost;
  return { host, response };
}

describe('PrismaExceptionFilter', () => {
  const secret = 'scrypt$17$8$c2VjcmV0$aGFzaA==';
  let logged: string[];

  beforeEach(() => {
    logged = [];
    jest.spyOn(Logger.prototype, 'error').mockImplementation((message: unknown) => {
      logged.push(String(message));
    });
  });

  afterEach(() => jest.restoreAllMocks());

  it('maps a unique constraint violation to 409 without echoing values', () => {
    const { host, response } = fakeHost();
    const error = new Prisma.PrismaClientKnownRequestError(`Unique constraint failed ${secret}`, {
      code: 'P2002',
      clientVersion: 'test',
    });
    new PrismaExceptionFilter().catch(error, host);
    expect(response.status).toHaveBeenCalledWith(409);
    expect(JSON.stringify(response.json.mock.calls)).not.toContain(secret);
  });

  it('answers 500 for query validation errors and never logs their message (it contains data)', () => {
    const { host, response } = fakeHost();
    const error = new Prisma.PrismaClientValidationError(
      `Invalid invocation { passwordHash: "${secret}" }`,
      {
        clientVersion: 'test',
      },
    );
    new PrismaExceptionFilter().catch(error, host);
    expect(response.status).toHaveBeenCalledWith(500);
    expect(JSON.stringify(response.json.mock.calls)).not.toContain(secret);
    expect(logged.join('\n')).not.toContain(secret);
    expect(logged.join('\n')).toContain('PrismaClientValidationError');
  });

  it('answers 500 for unknown database errors (e.g. failing CHECK rows) without logging the row', () => {
    const { host, response } = fakeHost();
    const error = new Prisma.PrismaClientUnknownRequestError(
      `violates check constraint. Failing row contains (${secret})`,
      {
        clientVersion: 'test',
      },
    );
    new PrismaExceptionFilter().catch(error, host);
    expect(response.status).toHaveBeenCalledWith(500);
    expect(logged.join('\n')).not.toContain(secret);
  });
});
