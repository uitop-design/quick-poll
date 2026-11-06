import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const pollOptionResultSchema = z.object({
  id: z.uuid(),
  text: z.string(),
  position: z.number().int(),
  votes: z.number().int(),
  percent: z.number().describe('Share of all votes, rounded to one decimal place'),
});

export const pollSummarySchema = z.object({
  id: z.uuid(),
  question: z.string(),
  closesAt: z.iso.datetime().nullable().describe('null when the poll has no deadline'),
  isClosed: z.boolean(),
  totalVotes: z.number().int(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const pollResultsSchema = pollSummarySchema.extend({
  options: z.array(pollOptionResultSchema),
});

export const pollPageSchema = z.object({
  items: z.array(pollSummarySchema),
  total: z.number().int(),
  page: z.number().int(),
  limit: z.number().int(),
});

export type PollOptionResult = z.infer<typeof pollOptionResultSchema>;
export type PollSummary = z.infer<typeof pollSummarySchema>;
export type PollResults = z.infer<typeof pollResultsSchema>;
export type PollPage = z.infer<typeof pollPageSchema>;

export class PollResultsDto extends createZodDto(pollResultsSchema) {}

export class PollPageDto extends createZodDto(pollPageSchema) {}
