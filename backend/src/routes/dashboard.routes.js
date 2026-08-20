import { Router } from 'express';

import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

router.use(requireAuth);

// Backs the admin dashboard's stat cards + OnboardingSetup's step-completion
// checks. Both previously fetched full record lists (students with nested
// guardians/user, staff with nested subjects/classes, etc.) purely to read
// `.length` or check `.length > 0` — this replaces all of that with cheap
// COUNT queries, run as a single transaction (one DB round trip, same
// consistency guarantee as before since counts are visible instantly).
//
// Response shape is intentionally a superset covering both call sites so
// a school-wide summary only has to be fetched once per dashboard load
// instead of twice (dashboard page + OnboardingSetup each fetching the
// same underlying data independently).
router.get(
  '/summary',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const [studentsCount, staffCount, guardiansCount, classesCount, subjectsCount, sessionsCount, termsCount] =
      await prisma.$transaction([
        prisma.student.count(),
        prisma.staff.count(),
        prisma.guardian.count(),
        prisma.class.count(),
        prisma.subject.count(),
        prisma.academicSession.count(),
        prisma.term.count(),
      ]);

    return res.json({
      counts: {
        students: studentsCount,
        staff: staffCount,
        guardians: guardiansCount,
        classes: classesCount,
        subjects: subjectsCount,
      },
      setup: {
        hasSession: sessionsCount > 0,
        // A term always belongs to a session, so "any term exists at all"
        // is equivalent to the original "some session has ≥1 term" check.
        hasTerm: termsCount > 0,
        hasClasses: classesCount > 0,
        hasSubjects: subjectsCount > 0,
        hasStaff: staffCount > 0,
        hasStudents: studentsCount > 0,
      },
    });
  }),
);

export default router;
