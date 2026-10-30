import type { User } from '@prisma/client';
import type { UserProfileDto } from '../auth/dto/auth.dto';

/** The only shape in which a user leaves the API: never includes the password hash. */
export function toUserProfile(user: User): UserProfileDto {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    createdAt: user.createdAt,
  };
}
