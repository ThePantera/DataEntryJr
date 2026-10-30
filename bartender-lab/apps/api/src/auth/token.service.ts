import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { UserRole } from '@prisma/client';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { APP_CONFIG, type AppConfig } from '../config/env.validation';
import { PrismaService } from '../prisma/prisma.service';

export const JWT_ISSUER = 'bartender-lab-api';
const REFRESH_TOKEN_BYTES = 32;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
}

export interface IssuedRefreshToken {
  token: string;
  expiresAt: Date;
}

function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  get accessTokenTtlSeconds(): number {
    return this.config.jwtAccessTtlSeconds;
  }

  signAccessToken(user: { id: string; role: UserRole }): Promise<string> {
    const payload: AccessTokenPayload = { sub: user.id, role: user.role };
    return this.jwt.signAsync(payload);
  }

  /** Returns the payload of a valid access token, or null for any invalid/expired token. */
  async verifyAccessToken(token: string): Promise<AccessTokenPayload | null> {
    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
      return typeof payload.sub === 'string' ? payload : null;
    } catch {
      return null;
    }
  }

  /** Creates an opaque refresh token. Only its SHA-256 hash is stored. */
  async issueRefreshToken(
    userId: string,
    familyId: string = randomUUID(),
  ): Promise<IssuedRefreshToken> {
    const token = randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
    const expiresAt = new Date(Date.now() + this.config.refreshTokenTtlDays * DAY_MS);
    await this.prisma.refreshToken.create({
      data: { userId, familyId, tokenHash: hashRefreshToken(token), expiresAt },
    });
    return { token, expiresAt };
  }

  /**
   * Single-use rotation: the presented token is revoked and a new one is issued in the same family.
   * Presenting an already revoked token is treated as theft and revokes the whole family.
   */
  async rotateRefreshToken(
    token: string,
  ): Promise<{ userId: string; refreshToken: IssuedRefreshToken }> {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashRefreshToken(token) },
    });
    if (!stored || stored.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Conditional update makes rotation atomic: two concurrent uses cannot both succeed.
    const { count } = await this.prisma.refreshToken.updateMany({
      where: { id: stored.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (count === 0) {
      await this.revokeFamily(stored.familyId);
      throw new UnauthorizedException('Invalid refresh token');
    }

    const refreshToken = await this.issueRefreshToken(stored.userId, stored.familyId);
    return { userId: stored.userId, refreshToken };
  }

  /** Logout: revokes the token's whole family (idempotent, unknown tokens are ignored). */
  async revokeRefreshToken(token: string): Promise<void> {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashRefreshToken(token) },
    });
    if (stored) await this.revokeFamily(stored.familyId);
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
