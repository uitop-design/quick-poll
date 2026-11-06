import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { pollIdSchema } from '../../polls/dto/poll-id-param.dto.js';

export const pollSubscriptionSchema = z.object({ pollId: pollIdSchema });

export class PollSubscriptionDto extends createZodDto(pollSubscriptionSchema) {}
