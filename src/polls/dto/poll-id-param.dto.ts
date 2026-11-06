import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { uuidSchema } from '../../common/schemas/uuid.schema.js';

export const pollIdSchema = uuidSchema().describe('Poll id');

export const pollIdParamSchema = z.object({ id: pollIdSchema });

export class PollIdParamDto extends createZodDto(pollIdParamSchema) {}
