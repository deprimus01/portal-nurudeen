import { z } from 'zod';

// Deliberately all-optional — a correction PATCH sends only the field(s)
// the user changed in the preview grid, merged onto the record's existing
// mappedData server-side. classId/guardianId let the user resolve an
// unmatched class or override a fuzzy guardian match explicitly, rather
// than retyping the free-text class/guardian columns.
export const importRecordCorrectionSchema = z.object({
  firstName: z.string().trim().max(60).optional(),
  lastName: z.string().trim().max(60).optional(),
  otherNames: z.string().trim().max(60).optional(),
  admissionNumber: z.string().trim().max(30).optional(),
  dateOfBirth: z.coerce.date().optional(),
  gender: z.enum(['MALE', 'FEMALE']).optional(),
  classId: z.string().cuid().optional(),
  guardianId: z.string().cuid().nullable().optional(),
  guardianFirstName: z.string().trim().max(60).optional(),
  guardianLastName: z.string().trim().max(60).optional(),
  guardianPhone: z.string().trim().max(20).optional(),
  guardianEmail: z.string().trim().email().optional().or(z.literal('')),
  guardianRelationship: z.enum(['FATHER', 'MOTHER', 'GUARDIAN', 'OTHER']).optional(),
  // Explicit user action to exclude this row from commit without deleting
  // it — distinct from an ERROR row, which is blocked automatically.
  skip: z.boolean().optional(),
});
