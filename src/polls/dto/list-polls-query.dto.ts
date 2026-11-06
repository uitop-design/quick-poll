import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const listPollsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1_000_000).default(1).describe('Page number'),
  limit: z.coerce.number().int().min(1).max(100).default(20).describe('Page size, up to 100'),
});

export class ListPollsQueryDto extends createZodDto(listPollsQuerySchema) {}
