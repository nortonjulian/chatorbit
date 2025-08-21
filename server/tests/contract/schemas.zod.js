import { z } from 'zod';

export const MessageSchema = z.object({
  id: z.union([z.string(), z.number()]),
  chatRoomId: z.union([z.string(), z.number()]),
  content: z.string().optional(),
  rawContent: z.string().optional(),
  senderId: z.union([z.string(), z.number()]).optional(),
  createdAt: z.union([z.string(), z.date()]).optional(),
});

export const MessageListSchema = z.object({
  items: z.array(MessageSchema)
}).or(z.array(MessageSchema)); // tolerate raw arrays while stabilizing
