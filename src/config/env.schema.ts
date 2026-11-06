import { z } from 'zod';

const booleanString = z.enum(['true', 'false']).transform((value) => value === 'true');

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3200),
  TRUST_PROXY: booleanString.default(false),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  REDIS_URL: z.url({ protocol: /^rediss?$/ }),
  RESULTS_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(60),
  VOTE_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  VOTE_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv<T extends z.ZodType>(
  schema: T,
  source: Record<string, unknown>,
): z.infer<T> {
  const result = schema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

export function validateEnv(source: Record<string, unknown>): Env {
  return parseEnv(envSchema, source);
}
