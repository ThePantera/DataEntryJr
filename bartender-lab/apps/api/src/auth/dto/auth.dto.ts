import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { UserRole } from '@prisma/client';

const normalizeEmail = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value));

export class RegisterDto {
  @ApiProperty({ example: 'ana@example.com', maxLength: 254 })
  @normalizeEmail()
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({ minLength: 8, maxLength: 128, example: 'una-contraseña-larga' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;

  @ApiProperty({ example: 'Ana', minLength: 1, maxLength: 80 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  displayName: string;
}

export class LoginDto {
  @ApiProperty({ example: 'ana@example.com' })
  @normalizeEmail()
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({ example: 'una-contraseña-larga' })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password: string;
}

export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh token opaco recibido en login/registro/refresh.' })
  @IsString()
  @MinLength(20)
  @MaxLength(200)
  refreshToken: string;
}

export class UserProfileDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() email: string;
  @ApiProperty() displayName: string;
  @ApiProperty({ enum: UserRole }) role: UserRole;
  @ApiProperty() createdAt: Date;
}

export class AuthResponseDto {
  @ApiProperty({ type: UserProfileDto }) user: UserProfileDto;
  @ApiProperty({ description: 'JWT de acceso (Bearer).' }) accessToken: string;
  @ApiProperty({ description: 'Segundos de validez del access token.' })
  accessTokenExpiresIn: number;
  @ApiProperty({ description: 'Token opaco de un solo uso para renovar la sesión.' })
  refreshToken: string;
  @ApiProperty() refreshTokenExpiresAt: Date;
}
