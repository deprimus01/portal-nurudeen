import { z } from 'zod';

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];

// A slot is either a real lesson (subjectId + staffId) or a labeled block
// like "Assembly"/"Break" (label, no subject/staff) — not both, not neither.
export const upsertSlotSchema = z
  .object({
    classId: z.string().cuid('Select a class.'),
    dayOfWeek: z.enum(DAYS, { errorMap: () => ({ message: 'Select a valid day.' }) }),
    period: z.coerce.number().int().min(1).max(12),
    label: z.string().trim().max(40).optional(),
    subjectId: z.string().cuid().optional(),
    staffId: z.string().cuid().optional(),
  })
  .refine((data) => data.label || (data.subjectId && data.staffId), {
    message: 'Provide either a label (e.g. "Break") or both a subject and a teacher.',
  });

export const clearSlotSchema = z.object({
  classId: z.string().cuid('Select a class.'),
  dayOfWeek: z.enum(DAYS),
  period: z.coerce.number().int().min(1).max(12),
});
