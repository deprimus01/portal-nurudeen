import { z } from 'zod';

export const createClassSchema = z.object({
  name: z.string().trim().min(1, 'Class name is required.').max(40),
  level: z.enum(['NURSERY', 'PRIMARY', 'JUNIOR_SECONDARY', 'SENIOR_SECONDARY']),
  sortOrder: z.coerce.number().int().min(0),
});
export const updateClassSchema = createClassSchema.partial();

export const createSubjectSchema = z.object({
  name: z.string().trim().min(1, 'Subject name is required.').max(60),
  code: z.string().trim().max(20).optional(),
});
export const updateSubjectSchema = createSubjectSchema.partial();

export const createSessionSchema = z.object({
  name: z.string().trim().min(1, 'Session name is required.').max(20), // e.g. "2025/2026"
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  isCurrent: z.boolean().optional().default(false),
});
export const updateSessionSchema = createSessionSchema.partial();

export const createTermSchema = z.object({
  name: z.string().trim().min(1, 'Term name is required.').max(40),
  sessionId: z.string().cuid('Select an academic session.'),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  isCurrent: z.boolean().optional().default(false),
});
export const updateTermSchema = createTermSchema.partial();

export const createEnrollmentSchema = z.object({
  studentId: z.string().cuid('Select a student.'),
  classId: z.string().cuid('Select a class.'),
  sectionId: z.string().cuid().optional(),
  termId: z.string().cuid('Select a term.'),
  status: z.enum(['ACTIVE', 'COMPLETED', 'TRANSFERRED']).optional().default('ACTIVE'),
});
export const updateEnrollmentSchema = createEnrollmentSchema.partial();
