import type { UserRole } from '@prisma/client';

/** The caller attached to the request by JwtAuthGuard (role re-read from the database). */
export interface AuthenticatedUser {
  id: string;
  role: UserRole;
}

export interface RequestWithUser {
  user?: AuthenticatedUser;
  headers: Record<string, string | string[] | undefined>;
}
