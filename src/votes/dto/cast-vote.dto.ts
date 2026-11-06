import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const castVoteSchema = z.strictObject({
  optionId: z.uuid().describe('Id of an option of this poll'),
  voterId: z.uuid().describe('Client-generated voter id; one vote per voter in a poll'),
});

export class CastVoteDto extends createZodDto(castVoteSchema) {}
