import { z } from 'zod';

export const createAnnouncementSchema = z.object({
  title: z.string().trim().min(1, 'Title is required.').max(120),
  body: z.string().trim().min(1, 'Body is required.').max(4000),
  audience: z.enum(['SCHOOL_WIDE', 'CLASS']),
  classId: z.string().cuid().optional(),
}).refine((data) => data.audience !== 'CLASS' || !!data.classId, {
  message: 'Select a class for a class-wide announcement.',
  path: ['classId'],
});

export const sendMessageSchema = z.object({
  recipientUserId: z.string().cuid('Select a recipient.'),
  body: z.string().trim().min(1, 'Message cannot be empty.').max(4000),
});
