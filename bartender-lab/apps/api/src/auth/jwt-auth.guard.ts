import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { RequestWithUser } from '../common/authenticated-user';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { TokenService } from './token.service';

function extractBearerToken(request: RequestWithUser): string | null {
  const header = request.headers.authorization;
  if (typeof header !== 'string') return null;
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}

/**
 * Global authentication guard. Every route requires a valid access token unless marked @Public().
 * The user's current role is re-read from the database so demotions take effect immediately.
 * On public routes an invalid or expired token is ignored (offline clients may hold stale tokens).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = extractBearerToken(request);

    const payload = token ? await this.tokens.verifyAccessToken(token) : null;
    const user = payload
      ? await this.prisma.user.findUnique({
          where: { id: payload.sub },
          select: { id: true, role: true },
        })
      : null;

    if (user) {
      request.user = user;
      return true;
    }
    if (isPublic) return true;
    throw new UnauthorizedException(
      token ? 'Invalid or expired access token' : 'Missing access token',
    );
  }
}
