import { z } from 'zod';

export const createStudentSchema = z.object({
  admissionNumber: z.string().trim().min(1, 'Admission number is required.').max(30),
  firstName: z.string().trim().min(1, 'First name is required.').max(60),
  lastName: z.string().trim().min(1, 'Last name is required.').max(60),
  otherNames: z.string().trim().max(60).optional(),
  dateOfBirth: z.coerce.date({ errorMap: () => ({ message: 'Enter a valid date of birth.' }) }),
  gender: z.enum(['MALE', 'FEMALE']),
  currentClassId: z.string().cuid().optional(),
  photoUrl: z.string().url().optional(),
  // Guardians are attached at creation time so a portal account can be
  // provisioned immediately — PRD §1.6, invite-only, tied to enrollment.
  guardians: z
    .array(
      z.object({
        guardianId: z.string().cuid().optional(), // link to existing guardian
        // ...or create a new one inline:
        firstName: z.string().trim().max(60).optional(),
        lastName: z.string().trim().max(60).optional(),
        phone: z.string().trim().max(20).optional(),
        email: z.string().trim().email().optional(),
        relationship: z.enum(['FATHER', 'MOTHER', 'GUARDIAN', 'OTHER']),
        isPrimary: z.boolean().default(false),
      }),
    )
    .min(1, 'At least one guardian is required.')
    .max(4, 'A student can have at most 4 linked guardians.'),
});

export const updateStudentSchema = createStudentSchema
  .omit({ guardians: true })
  .partial();

export const createGuardianSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required.').max(60),
  lastName: z.string().trim().min(1, 'Last name is required.').max(60),
  phone: z.string().trim().min(1, 'Phone number is required.').max(20),
  email: z.string().trim().email('Enter a valid email address.').optional(),
  address: z.string().trim().max(200).optional(),
});

export const updateGuardianSchema = createGuardianSchema.partial();
