import { z } from 'zod';

export const createStudentSchema = z.object({
  admissionNumber: z.string().trim().min(1, 'Serial number is required.').max(30),
  firstName: z.string().trim().min(1, 'First name is required.').max(60),
  lastName: z.string().trim().min(1, 'Last name is required.').max(60),
  otherNames: z.string().trim().max(60).optional(),
  dateOfBirth: z.coerce.date({ errorMap: () => ({ message: 'Enter a valid date of birth.' }) }).optional(),
  gender: z.enum(['MALE', 'FEMALE']),
  currentClassId: z.string().cuid().optional(),
  photoUrl: z.string().url().optional(),
  // Guardians are optional at creation time — this school does not
  // require guardian details to enroll a student. When provided, a
  // portal account is still provisioned immediately per guardian, same
  // as before.
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
    .max(4, 'A student can have at most 4 linked guardians.')
    .default([]),
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
