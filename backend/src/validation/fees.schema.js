import { z } from 'zod';

export const createFeeStructureSchema = z.object({
  classId: z.string().cuid('Select a class.'),
  termId: z.string().cuid('Select a term.'),
  description: z.string().trim().min(1, 'Description is required.').max(80),
  // Entered in Naira in the UI, converted to kobo before hitting this
  // schema — see the frontend's submit handler.
  amount: z.coerce.number().int().positive('Amount must be greater than zero.'),
});

export const generateInvoicesSchema = z.object({
  classId: z.string().cuid('Select a class.'),
  termId: z.string().cuid('Select a term.'),
  dueDate: z.coerce.date({ errorMap: () => ({ message: 'Enter a valid due date.' }) }),
});

export const recordPaymentSchema = z.object({
  invoiceId: z.string().cuid(),
  amount: z.coerce.number().int().positive('Amount must be greater than zero.'),
  method: z.enum(['CASH', 'BANK_TRANSFER', 'PAYSTACK', 'FLUTTERWAVE']),
  reference: z.string().trim().max(100).optional(),
});
