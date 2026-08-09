import { z } from 'zod';

export const createGradingSchemeSchema = z
  .object({
    name: z.string().trim().min(1, 'Scheme name is required.').max(60),
    description: z.string().trim().max(200).optional(),
    bands: z
      .array(
        z.object({
          minScore: z.coerce.number().int().min(0).max(100),
          maxScore: z.coerce.number().int().min(0).max(100),
          grade: z.string().trim().min(1).max(10),
          remark: z.string().trim().min(1).max(40),
        }),
      )
      .min(1, 'At least one grading band is required.'),
  })
  // Bands must be internally valid (min <= max) and mutually non-overlapping —
  // resolveGrade() takes the *first* matching band, so an overlap doesn't error
  // at runtime, it silently makes grading depend on array order. Catch it here
  // instead of leaving it to admin discipline.
  .superRefine((data, ctx) => {
    data.bands.forEach((band, i) => {
      if (band.minScore > band.maxScore) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Band ${i + 1} (${band.grade}): min score cannot be greater than max score.`,
          path: ['bands', i, 'minScore'],
        });
      }
    });

    for (let i = 0; i < data.bands.length; i++) {
      for (let j = i + 1; j < data.bands.length; j++) {
        const a = data.bands[i];
        const b = data.bands[j];
        if (a.minScore <= b.maxScore && b.minScore <= a.maxScore) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Bands "${a.grade}" (${a.minScore}–${a.maxScore}) and "${b.grade}" (${b.minScore}–${b.maxScore}) overlap.`,
            path: ['bands', j, 'minScore'],
          });
        }
      }
    }
  });

export const createExamSchema = z.object({
  name: z.string().trim().min(1, 'Exam name is required.').max(80),
  termId: z.string().cuid('Select a term.'),
  classId: z.string().cuid('Select a class.'),
  gradingSchemeId: z.string().cuid('Select a grading scheme.'),
});

export const markResultsSchema = z.object({
  examId: z.string().cuid(),
  subjectId: z.string().cuid('Select a subject.'),
  records: z
    .array(
      z.object({
        studentId: z.string().cuid(),
        score: z.coerce.number().int().min(0, 'Score cannot be negative.').max(100, 'Score cannot exceed 100.'),
      }),
    )
    .min(1, 'At least one score is required.'),
});
