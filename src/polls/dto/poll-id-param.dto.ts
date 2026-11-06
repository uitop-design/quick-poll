import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const pollIdSchema = z.uuid().describe('Poll id');

export const pollIdParamSchema = z.object({ id: pollIdSchema });

export class PollIdParamDto extends createZodDto(pollIdParamSchema) {}
