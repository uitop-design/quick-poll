import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { uuidSchema } from '../../common/schemas/uuid.schema.js';

export const castVoteSchema = z.strictObject({
  optionId: uuidSchema().describe('Id of an option of this poll'),
  voterId: uuidSchema().describe('Client-generated voter id; one vote per voter in a poll'),
});

export class CastVoteDto extends createZodDto(castVoteSchema) {}
