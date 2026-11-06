import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const healthStatusSchema = z.object({
  status: z.literal('ok'),
  checks: z.object({
    postgres: z.literal('up'),
    redis: z.literal('up'),
  }),
});

export type HealthStatus = z.infer<typeof healthStatusSchema>;

export class HealthStatusDto extends createZodDto(healthStatusSchema) {}
