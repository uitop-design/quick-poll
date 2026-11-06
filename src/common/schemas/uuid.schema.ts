import { z } from 'zod';

export const uuidSchema = (): z.ZodUUID => z.uuid().toLowerCase();
