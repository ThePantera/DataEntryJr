import { SetMetadata } from '@nestjs/common';

export const AUTH_RATE_LIMIT_KEY = 'authRateLimit';

/** Applies the stricter "auth" throttler (AUTH_THROTTLE_LIMIT) to every route of a controller. */
export const AuthRateLimit = () => SetMetadata(AUTH_RATE_LIMIT_KEY, true);
