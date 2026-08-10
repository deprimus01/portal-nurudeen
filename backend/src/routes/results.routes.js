import { Router } from 'express';

import { prisma } from '../lib/prisma.js';
import { logAction } from '../lib/auditLog.js';
import { computeReportCard } from '../lib/reportCard.js';
import { assertCanViewStudentRecord } from '../lib/guardianOwnership.js';
import { notifyResultsPublished } from '../lib/notifications.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateBody, asyncHandler } from '../middleware/errorHandler.js';
import { markResultsSchema } from '../validation/results.schema.js';

const router = Router();

router.use(requireAuth);

// PRD Roles & Permissions: "Enter exam results: Teacher Yes (own subjects)".
// Admin can enter for any subject; a teacher must be assigned to teach the
// subject in question (StaffSubject), independent of which class it's for.
async function assertCanEnterResultsForSubject(user, subjectId) {
  if (user.role === 'ADMIN') return true;

  if (user.role !== 'TEACHER') {
    const err = new Error('You do not have permission to do that.');
    err.statusCode = 403;
    throw err;
  }

  const assignment = await prisma.staffSubject.findFirst({
    where: { staffId: user.staffId, subjectId },
  });

  if (!assignment) {
    const err = new Error('You are not assigned to teach this subject.');
    err.statusCode = 403;
    throw err;
  }

  return true;
}

// Roster for one exam + subject: every student enrolled in the exam's
// class/term, merged with any score already entered for that subject.
router.get(
  '/roster',
  requireRole('ADMIN', 'TEACHER'),
  asyncHandler(async (req, res) => {
    const { examId, subjectId } = req.query;
    if (!examId || !subjectId) {
      return res.status(400).json({ error: 'examId and subjectId are required.' });
    }

    await assertCanEnterResultsForSubject(req.user, subjectId);

    const exam = await prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) return res.status(404).json({ error: 'Exam not found.' });

    const enrollments = await prisma.enrollment.findMany({
      where: { classId: exam.classId, termId: exam.termId, status: 'ACTIVE' },
      include: { student: true },
      orderBy: [{ student: { lastName: 'asc' } }, { student: { firstName: 'asc' } }],
    });

    const existingResults = await prisma.result.findMany({
      where: { examId, subjectId, studentId: { in: enrollments.map((e) => e.studentId) } },
    });
    const scoreByStudent = new Map(existingResults.map((r) => [r.studentId, r.score]));

    const roster = enrollments.map((e) => ({
      studentId: e.student.id,
      admissionNumber: e.student.admissionNumber,
      firstName: e.student.firstName,
      lastName: e.student.lastName,
      score: scoreByStudent.has(e.student.id) ? scoreByStudent.get(e.student.id) : null,
    }));

    return res.json({ exam, roster });
  }),
);

router.post(
  '/',
  requireRole('ADMIN', 'TEACHER'),
  validateBody(markResultsSchema),
  asyncHandler(async (req, res) => {
    const { examId, subjectId, records } = req.body;

    await assertCanEnterResultsForSubject(req.user, subjectId);

    const enteredById = req.user.staffId;

    if (!enteredById) {
      return res.status(400).json({
        error: 'Your account is not linked to a staff record, so results cannot be attributed. Ask another admin to enter these.',
      });
    }

    await prisma.$transaction(
      records.map((r) =>
        prisma.result.upsert({
          where: { examId_studentId_subjectId: { examId, studentId: r.studentId, subjectId } },
          create: { examId, studentId: r.studentId, subjectId, score: r.score, enteredById },
          update: { score: r.score, enteredById },
        }),
      ),
    );

    await logAction({
      userId: req.user.id,
      action: 'results.mark',
      entityType: 'Result',
      metadata: { examId, subjectId, count: records.length },
    });

    const [exam, subject] = await Promise.all([
      prisma.exam.findUnique({ where: { id: examId }, select: { name: true } }),
      prisma.subject.findUnique({ where: { id: subjectId }, select: { name: true } }),
    ]);

    // One notification per affected student (+ their guardians) — the
    // recipients themselves only see their own child's result, so this
    // isn't a bulk blast even though it's one route call for a whole class.
    await Promise.all(
      records.map((r) =>
        notifyResultsPublished({
          studentId: r.studentId,
          subjectName: subject?.name || 'a subject',
          examName: exam?.name || 'an exam',
          examId,
        }),
      ),
    );

    return res.json({ ok: true, count: records.length });
  }),
);

// Full report card for one student on one exam — computation lives in
// lib/reportCard.js so the AI comment generator (Phase 7) uses the exact
// same source of truth, not a re-derived copy.
router.get(
  '/report-card',
  requireRole('ADMIN', 'TEACHER', 'GUARDIAN', 'STUDENT'),
  asyncHandler(async (req, res) => {
    const { studentId, examId } = req.query;
    if (!studentId || !examId) {
      return res.status(400).json({ error: 'studentId and examId are required.' });
    }

    await assertCanViewStudentRecord(req.user, studentId);

    const card = await computeReportCard(examId, studentId);
    if (!card) return res.status(404).json({ error: 'Exam or student not found.' });

    const existingComment = await prisma.reportCardComment.findUnique({
      where: { examId_studentId: { examId, studentId } },
    });

    return res.json({
      student: card.student,
      exam: card.examSummary,
      rows: card.rows,
      average: card.average,
      complete: card.complete,
      comment: existingComment?.comment || null,
    });
  }),
);

export default router;
