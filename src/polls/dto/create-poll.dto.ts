import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const MIN_POLL_TTL_SECONDS = 60;
export const MAX_POLL_TTL_SECONDS = 30 * 24 * 60 * 60;

const hasUniqueOptions = (options: string[]): boolean =>
  new Set(options.map((option) => option.toLowerCase())).size === options.length;

export const createPollSchema = z.strictObject({
  question: z.string().trim().min(3).max(200).describe('Poll question, 3-200 characters'),
  options: z
    .array(z.string().trim().min(1).max(100))
    .min(2)
    .max(10)
    .refine(hasUniqueOptions, { message: 'Options must be unique (case-insensitive)' })
    .describe('2-10 unique answer options, 1-100 characters each'),
  ttlSeconds: z
    .number()
    .int()
    .min(MIN_POLL_TTL_SECONDS)
    .max(MAX_POLL_TTL_SECONDS)
    .optional()
    .describe('Poll lifetime in seconds (60 seconds to 30 days); omit for a poll without deadline'),
});

export class CreatePollDto extends createZodDto(createPollSchema) {}
