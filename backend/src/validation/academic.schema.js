import { z } from 'zod';

export const createClassSchema = z.object({
  name: z.string().trim().min(1, 'Class name is required.').max(40),
  level: z.enum(['NURSERY', 'PRIMARY', 'JUNIOR_SECONDARY', 'SENIOR_SECONDARY']),
  // Optional on input - auto-assigned server-side (see classes.routes.js POST
  // handler) so admins don't have to hand-pick a number. Still accepted here
  // for the Move Up/Down reorder actions, which do set it explicitly.
  sortOrder: z.coerce.number().int().min(0).optional(),
});
export const updateClassSchema = createClassSchema.partial();

export const createSubjectSchema = z.object({
  name: z.string().trim().min(1, 'Subject name is required.').max(60),
  code: z.string().trim().max(20).optional(),
});
export const updateSubjectSchema = createSubjectSchema.partial();

const sessionBase = z.object({
  name: z.string().trim().min(1, 'Session name is required.').max(20), // e.g. "2025/2026"
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  isCurrent: z.boolean().optional().default(false),
});
const sessionDateOrder = (data) => !data.startDate || !data.endDate || data.endDate > data.startDate;
export const createSessionSchema = sessionBase.refine(sessionDateOrder, {
  message: 'End date must be after start date.',
  path: ['endDate'],
});
export const updateSessionSchema = sessionBase.partial().refine(sessionDateOrder, {
  message: 'End date must be after start date.',
  path: ['endDate'],
});

const termBase = z.object({
  name: z.string().trim().min(1, 'Term name is required.').max(40),
  sessionId: z.string().cuid('Select an academic session.'),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  isCurrent: z.boolean().optional().default(false),
});
const termDateOrder = (data) => !data.startDate || !data.endDate || data.endDate > data.startDate;
export const createTermSchema = termBase.refine(termDateOrder, {
  message: 'End date must be after start date.',
  path: ['endDate'],
});
export const updateTermSchema = termBase.partial().refine(termDateOrder, {
  message: 'End date must be after start date.',
  path: ['endDate'],
});

export const createEnrollmentSchema = z.object({
  studentId: z.string().cuid('Select a student.'),
  classId: z.string().cuid('Select a class.'),
  sectionId: z.string().cuid().optional(),
  termId: z.string().cuid('Select a term.'),
  status: z.enum(['ACTIVE', 'COMPLETED', 'TRANSFERRED']).optional().default('ACTIVE'),
});
export const updateEnrollmentSchema = createEnrollmentSchema.partial();
