import { z } from 'zod';

export const markAttendanceSchema = z.object({
  classId: z.string().cuid('Select a class.'),
  date: z.coerce.date({ errorMap: () => ({ message: 'Enter a valid date.' }) }),
  records: z
    .array(
      z.object({
        studentId: z.string().cuid(),
        status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']),
      }),
    )
    .min(1, 'At least one attendance record is required.'),
});
