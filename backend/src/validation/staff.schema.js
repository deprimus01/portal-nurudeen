import { z } from 'zod';

export const createStaffSchema = z.object({
  employeeId: z.string().trim().min(1, 'Employee ID is required.').max(30),
  firstName: z.string().trim().min(1, 'First name is required.').max(60),
  lastName: z.string().trim().min(1, 'Last name is required.').max(60),
  phone: z.string().trim().min(1, 'Phone number is required.').max(20),
  email: z.string().trim().email('Enter a valid email address.').optional(),
  role: z.enum(['TEACHER', 'ADMIN', 'TEACHER_ADMIN']),
  subjectIds: z.array(z.string().cuid()).optional().default([]),
  classIds: z.array(z.string().cuid()).optional().default([]),
});

export const updateStaffSchema = createStaffSchema.partial();
