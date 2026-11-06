import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const errorResponseSchema = z.object({
  statusCode: z.number().int().describe('HTTP status code'),
  error: z.string().describe('HTTP status text'),
  message: z
    .union([z.string(), z.array(z.string())])
    .describe('Error message or list of validation messages'),
  path: z.string().describe('Request path or WebSocket event'),
  timestamp: z.iso.datetime().describe('Time the error occurred'),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;

export class ErrorResponseDto extends createZodDto(errorResponseSchema) {}
