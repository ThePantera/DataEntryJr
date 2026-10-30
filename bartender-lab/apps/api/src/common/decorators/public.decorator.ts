import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a route as reachable without authentication (public content must work without login).
 * A valid bearer token is still read when present, so the route can personalise its answer.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
