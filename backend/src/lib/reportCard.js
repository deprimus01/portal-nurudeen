import { prisma } from './prisma.js';
import { resolveGrade } from './grading.js';
import { buildNameDisambiguationTags } from './nameDisambiguation.js';

// Computes a full report card for one student/exam: every subject in the
// exam's class curriculum, with score + resolved grade/remark, plus a
// simple average across whatever's been entered so far. Returns null if
// the exam or student doesn't exist — callers decide the 404 response.
export async function computeReportCard(examId, studentId) {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: { gradingScheme: { include: { bands: true } }, class: true, term: { include: { session: true } } },
  });
  if (!exam) return null;

  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) return null;

  const classSubjects = await prisma.classSubject.findMany({
    where: { classId: exam.classId },
    include: { subject: true },
    orderBy: { subject: { name: 'asc' } },
  });

  const results = await prisma.result.findMany({ where: { examId, studentId } });
  const scoreBySubject = new Map(results.map((r) => [r.subjectId, r.score]));

  const rows = classSubjects.map((cs) => {
    const score = scoreBySubject.get(cs.subjectId);
    if (score === undefined) {
      return { subject: cs.subject.name, score: null, grade: null, remark: 'Not yet entered' };
    }
    const { grade, remark } = resolveGrade(exam.gradingScheme, score);
    return { subject: cs.subject.name, score, grade, remark };
  });

  const enteredScores = rows.filter((r) => r.score !== null).map((r) => r.score);
  const average = enteredScores.length
    ? Math.round((enteredScores.reduce((a, b) => a + b, 0) / enteredScores.length) * 10) / 10
    : null;

  // A single-student lookup by design, but the name-collision tag needs
  // to know about the student's classmates too — fetched here just for
  // that, not persisted or returned beyond the tag itself.
  const classmates = await prisma.student.findMany({
    where: { currentClassId: exam.classId },
    select: { id: true, firstName: true, lastName: true, admissionNumber: true },
  });
  const tags = buildNameDisambiguationTags(classmates);
  const nameTag = tags.get(student.id) || '';

  return {
    exam,
    student: { id: student.id, name: `${student.firstName} ${student.lastName}${nameTag}` },
    examSummary: { id: exam.id, name: exam.name, class: exam.class.name, term: exam.term.name, session: exam.term.session.name },
    rows,
    average,
    complete: rows.every((r) => r.score !== null),
  };
}
