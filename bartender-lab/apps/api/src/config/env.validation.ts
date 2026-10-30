export const APP_CONFIG = Symbol('APP_CONFIG');

export type NodeEnv = 'development' | 'test' | 'production';

export interface AppConfig {
  nodeEnv: NodeEnv;
  port: number;
  databaseUrl: string;
  jwtAccessSecret: string;
  jwtAccessTtlSeconds: number;
  refreshTokenTtlDays: number;
  throttleTtlSeconds: number;
  throttleLimit: number;
  authThrottleLimit: number;
  corsOrigins: string[];
  trustProxy: boolean;
  swaggerEnabled: boolean;
  /** log2 of the scrypt cost parameter N. */
  passwordHashCost: number;
}

const NODE_ENVS: readonly NodeEnv[] = ['development', 'test', 'production'];
const MIN_SECRET_LENGTH = 32;
const PRODUCTION_MIN_HASH_COST = 17;
const PLACEHOLDER_SECRET_MARKER = 'change-me';

type Env = Record<string, string | undefined>;

/**
 * Validates and normalises environment variables at startup.
 * Error messages name the offending variables but never include their values.
 */
export function validateEnv(env: Env): AppConfig {
  const errors: string[] = [];

  const readInt = (name: string, fallback: number, min = 1, max = Number.MAX_SAFE_INTEGER) => {
    const raw = env[name];
    if (raw === undefined || raw === '') return fallback;
    const value = Number(raw);
    if (!Number.isInteger(value) || value < min || value > max) {
      errors.push(`${name} must be an integer between ${min} and ${max}`);
      return fallback;
    }
    return value;
  };
  const readBool = (name: string, fallback: boolean) => {
    const raw = env[name];
    if (raw === undefined || raw === '') return fallback;
    if (['1', 'true'].includes(raw.toLowerCase())) return true;
    if (['0', 'false'].includes(raw.toLowerCase())) return false;
    errors.push(`${name} must be 0/1 or true/false`);
    return fallback;
  };

  const nodeEnv = (env.NODE_ENV || 'development') as NodeEnv;
  if (!NODE_ENVS.includes(nodeEnv)) {
    errors.push(`NODE_ENV must be one of ${NODE_ENVS.join(', ')}`);
  }
  const isProduction = nodeEnv === 'production';

  const databaseUrl = env.DATABASE_URL ?? '';
  if (!/^postgres(ql)?:\/\//.test(databaseUrl)) {
    errors.push('DATABASE_URL is required and must be a postgresql:// URL');
  }

  const jwtAccessSecret = env.JWT_ACCESS_SECRET ?? '';
  if (jwtAccessSecret.length < MIN_SECRET_LENGTH) {
    errors.push(
      `JWT_ACCESS_SECRET is required and must have at least ${MIN_SECRET_LENGTH} characters`,
    );
  } else if (isProduction && jwtAccessSecret.includes(PLACEHOLDER_SECRET_MARKER)) {
    errors.push('JWT_ACCESS_SECRET still has the example placeholder value');
  }

  const passwordHashCost = readInt('PASSWORD_HASH_COST', PRODUCTION_MIN_HASH_COST, 10, 20);
  if (isProduction && passwordHashCost < PRODUCTION_MIN_HASH_COST) {
    errors.push(`PASSWORD_HASH_COST must be at least ${PRODUCTION_MIN_HASH_COST} in production`);
  }

  const config: AppConfig = {
    nodeEnv,
    port: readInt('PORT', 3000, 1, 65535),
    databaseUrl,
    jwtAccessSecret,
    jwtAccessTtlSeconds: readInt('JWT_ACCESS_TTL_SECONDS', 900),
    refreshTokenTtlDays: readInt('REFRESH_TOKEN_TTL_DAYS', 30),
    throttleTtlSeconds: readInt('THROTTLE_TTL_SECONDS', 60),
    throttleLimit: readInt('THROTTLE_LIMIT', 120),
    authThrottleLimit: readInt('AUTH_THROTTLE_LIMIT', 10),
    corsOrigins: (env.CORS_ORIGINS ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    trustProxy: readBool('TRUST_PROXY', false),
    swaggerEnabled: readBool('SWAGGER_ENABLED', true),
    passwordHashCost,
  };

  if (errors.length > 0) {
    throw new Error(`Invalid environment configuration:\n - ${errors.join('\n - ')}`);
  }
  return config;
}
