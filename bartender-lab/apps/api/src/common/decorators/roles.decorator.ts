import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

/** Restricts a route to the given roles (checked by RolesGuard after authentication). */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
