import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { toUserProfile } from '../users/user.mapper';
import type { AuthResponseDto, LoginDto, RegisterDto } from './dto/auth.dto';
import { PasswordHasher } from './password-hasher';
import { TokenService, type IssuedRefreshToken } from './token.service';

@Injectable()
export class AuthService {
  /** Verified against when the email is unknown, so response time does not reveal registered emails. */
  private dummyHash?: Promise<string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        displayName: dto.displayName,
        passwordHash: await this.hasher.hash(dto.password),
      },
    });
    return this.buildResponse(user, await this.tokens.issueRefreshToken(user.id));
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) {
      this.dummyHash ??= this.hasher.hash('timing-equalisation-only');
      await this.hasher.verify(dto.password, await this.dummyHash);
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!(await this.hasher.verify(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.buildResponse(user, await this.tokens.issueRefreshToken(user.id));
  }

  async refresh(refreshToken: string): Promise<AuthResponseDto> {
    const rotated = await this.tokens.rotateRefreshToken(refreshToken);
    const user = await this.prisma.user.findUnique({ where: { id: rotated.userId } });
    if (!user) throw new UnauthorizedException('Invalid refresh token');
    return this.buildResponse(user, rotated.refreshToken);
  }

  logout(refreshToken: string): Promise<void> {
    return this.tokens.revokeRefreshToken(refreshToken);
  }

  private async buildResponse(
    user: User,
    refreshToken: IssuedRefreshToken,
  ): Promise<AuthResponseDto> {
    return {
      user: toUserProfile(user),
      accessToken: await this.tokens.signAccessToken(user),
      accessTokenExpiresIn: this.tokens.accessTokenTtlSeconds,
      refreshToken: refreshToken.token,
      refreshTokenExpiresAt: refreshToken.expiresAt,
    };
  }
}
