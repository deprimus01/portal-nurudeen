import { prisma } from './prisma.js';
import { buildNameDisambiguationTags } from './nameDisambiguation.js';

// Phase 7 — "Attendance/performance flagging: proactive 'this student is
// trending down' alerts." Deliberately rule-based rather than LLM-based:
// the signal here is a numeric trend, not something that benefits from
// language generation, and a deterministic rule can't hallucinate a
// decline that isn't in the data. This also means /flags never calls the
// paid Groq API — see ai.routes.js for why it's mounted ahead of the AI
// rate limiter.

const ATTENDANCE_WINDOW_DAYS = 14;
const ATTENDANCE_MIN_RECORDS_PER_WINDOW = 3;
const ATTENDANCE_DECLINE_THRESHOLD = 0.25; // 25 percentage-point drop
const PERFORMANCE_DECLINE_THRESHOLD = 15; // 15-point drop in exam average

function daysAgo(n) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

function attendanceRate(records) {
  if (records.length === 0) return null;
  const presentish = records.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length;
  return presentish / records.length;
}

// Active students in scope, optionally restricted to a set of classIds
// (Admin: no restriction unless a specific class filter is passed;
// Teacher: always restricted to their assigned classes — that scoping is
// applied by the caller in ai.routes.js, not here).
async function activeStudentsInScope(classIds) {
  const term = await prisma.term.findFirst({ where: { isCurrent: true } });
  if (!term) return { term: null, students: [] };

  const enrollments = await prisma.enrollment.findMany({
    where: {
      termId: term.id,
      status: 'ACTIVE',
      ...(classIds ? { classId: { in: classIds } } : {}),
    },
    include: { student: true, class: true },
  });

  return { term, students: enrollments.map((e) => ({ ...e.student, className: e.class.name, classId: e.classId })) };
}

async function attendanceFlags(students, tags) {
  if (students.length === 0) return [];
  const studentIds = students.map((s) => s.id);

  const records = await prisma.attendanceRecord.findMany({
    where: { studentId: { in: studentIds }, date: { gte: daysAgo(ATTENDANCE_WINDOW_DAYS * 2 - 1) } },
    select: { studentId: true, date: true, status: true },
  });

  const byStudent = new Map();
  for (const r of records) {
    if (!byStudent.has(r.studentId)) byStudent.set(r.studentId, []);
    byStudent.get(r.studentId).push(r);
  }

  const cutoff = daysAgo(ATTENDANCE_WINDOW_DAYS);
  const flags = [];

  for (const student of students) {
    const all = byStudent.get(student.id) || [];
    const recent = all.filter((r) => r.date >= cutoff);
    const prior = all.filter((r) => r.date < cutoff);

    if (recent.length < ATTENDANCE_MIN_RECORDS_PER_WINDOW || prior.length < ATTENDANCE_MIN_RECORDS_PER_WINDOW) continue;

    const rateRecent = attendanceRate(recent);
    const ratePrior = attendanceRate(prior);
    const drop = ratePrior - rateRecent;

    if (drop >= ATTENDANCE_DECLINE_THRESHOLD) {
      flags.push({
        studentId: student.id,
        studentName: `${student.firstName} ${student.lastName}${tags.get(student.id) || ''}`,
        className: student.className,
        type: 'ATTENDANCE_DECLINE',
        severity: drop >= 0.4 ? 'HIGH' : 'MEDIUM',
        detail: `Attendance dropped from ${Math.round(ratePrior * 100)}% to ${Math.round(rateRecent * 100)}% over the last ${ATTENDANCE_WINDOW_DAYS} days (previous ${ATTENDANCE_WINDOW_DAYS} days as baseline).`,
      });
    }
  }

  return flags;
}

async function performanceFlags(students, tags) {
  if (students.length === 0) return [];
  const studentIds = students.map((s) => s.id);
  const classIds = [...new Set(students.map((s) => s.classId))];

  // Exams for these classes, most-recent-first, so we can compare each
  // student's latest exam average against their prior one.
  const exams = await prisma.exam.findMany({
    where: { classId: { in: classIds } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, classId: true, createdAt: true },
  });
  const examIds = exams.map((e) => e.id);

  const results = await prisma.result.findMany({
    where: { examId: { in: examIds }, studentId: { in: studentIds } },
    select: { examId: true, studentId: true, score: true },
  });

  // studentId -> examId -> [scores]
  const byStudentExam = new Map();
  for (const r of results) {
    if (!byStudentExam.has(r.studentId)) byStudentExam.set(r.studentId, new Map());
    const examMap = byStudentExam.get(r.studentId);
    if (!examMap.has(r.examId)) examMap.set(r.examId, []);
    examMap.get(r.examId).push(r.score);
  }

  const examOrderByClass = new Map();
  for (const exam of exams) {
    if (!examOrderByClass.has(exam.classId)) examOrderByClass.set(exam.classId, []);
    examOrderByClass.get(exam.classId).push(exam.id);
  }

  const flags = [];
  for (const student of students) {
    const examMap = byStudentExam.get(student.id);
    if (!examMap) continue;

    // Walk this student's class exam order (already newest-first) and take
    // the first two exams that actually have entered scores for them.
    const orderedExamIds = examOrderByClass.get(student.classId) || [];
    const examsWithScores = orderedExamIds.filter((id) => examMap.has(id));
    if (examsWithScores.length < 2) continue;

    const [latestId, priorId] = examsWithScores;
    const avg = (scores) => scores.reduce((a, b) => a + b, 0) / scores.length;
    const latestAvg = avg(examMap.get(latestId));
    const priorAvg = avg(examMap.get(priorId));
    const drop = priorAvg - latestAvg;

    if (drop >= PERFORMANCE_DECLINE_THRESHOLD) {
      flags.push({
        studentId: student.id,
        studentName: `${student.firstName} ${student.lastName}${tags.get(student.id) || ''}`,
        className: student.className,
        type: 'PERFORMANCE_DECLINE',
        severity: drop >= 25 ? 'HIGH' : 'MEDIUM',
        detail: `Exam average dropped from ${priorAvg.toFixed(1)} to ${latestAvg.toFixed(1)} between their last two exams.`,
      });
    }
  }

  return flags;
}

// Main entry point. classIds: undefined = no restriction (Admin, no
// filter); an array = restrict to those classes (Teacher's assigned
// classes, or Admin's explicit class filter).
export async function computeFlags(classIds) {
  const { term, students } = await activeStudentsInScope(classIds);
  if (!term) {
    return { term: null, flags: [], note: 'No current term is set. Set one under Sessions & Terms first.' };
  }

  // Scoped per class — flags can span multiple classes at once (Admin
  // with no filter, or a teacher assigned to several), and two students
  // sharing a name is only meaningful as a collision within the same
  // class, not across different ones.
  const tags = buildNameDisambiguationTags(students, { classKeyOf: (s) => s.classId });

  const [attendance, performance] = await Promise.all([attendanceFlags(students, tags), performanceFlags(students, tags)]);

  const flags = [...attendance, ...performance].sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'HIGH' ? -1 : 1;
    return a.studentName.localeCompare(b.studentName);
  });

  return { term, flags, note: null };
}
