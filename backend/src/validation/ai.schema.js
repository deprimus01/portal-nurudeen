import { z } from 'zod';

export const reportCardCommentDraftSchema = z.object({
  examId: z.string().cuid('Select an exam.'),
  studentId: z.string().cuid('Select a student.'),
});

export const saveReportCardCommentSchema = z.object({
  examId: z.string().cuid(),
  studentId: z.string().cuid(),
  comment: z.string().trim().min(1, 'Comment cannot be empty.').max(1000),
});

export const parentQaSchema = z.object({
  studentId: z.string().cuid('Select your child.'),
  question: z.string().trim().min(1, 'Enter a question.').max(500),
});

export const messageDraftSchema = z.object({
  recipientUserId: z.string().cuid('Select a recipient.'),
  instruction: z.string().trim().min(1, 'Say what the message should cover.').max(300),
});

export const nlReportSchema = z.object({
  question: z.string().trim().min(3, 'Enter a question.').max(300),
});

export const flagsQuerySchema = z.object({
  classId: z.string().cuid().nullish(),
});
