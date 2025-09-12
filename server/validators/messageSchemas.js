import { z } from 'zod';

export const createMessageSchema = z.object({
  chatRoomId: z.number().int().positive(),
  content: z.string().trim().min(1).max(8000).optional(),
  replyToId: z.number().int().positive().nullable().optional(),
});
