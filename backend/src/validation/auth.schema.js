import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Please enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
});

// Public, unauthenticated — see POST /auth/forgot-password. Deliberately
// the only piece of information needed to kick off a reset; everything
// else (who the account belongs to, where the OTP actually goes) is
// resolved server-side so this never has to ask "are you staff, a
// guardian, or a student".
export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('Please enter a valid email address.'),
});

export const resetPasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required.'),
  newPassword: z
    .string()
    .min(8, 'New password must be at least 8 characters.')
    .max(72, 'New password must be 72 characters or fewer.'),
});

// Self-service contact info update — deliberately narrower than the admin
// Staff/Guardian schemas (see staff.schema.js / student.schema.js): no
// name, employeeId, or role changes here, since those stay admin-managed.
export const updateContactSchema = z.object({
  phone: z.string().trim().min(1, 'Phone number is required.').max(20).optional(),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.').optional(),
  address: z.string().trim().max(200).optional(),
});

export const updatePreferencesSchema = z.object({
  notifyEmailAnnouncements: z.boolean().optional(),
  notifySmsAnnouncements: z.boolean().optional(),
  notifyEmailMessages: z.boolean().optional(),
  notifySmsMessages: z.boolean().optional(),
});
