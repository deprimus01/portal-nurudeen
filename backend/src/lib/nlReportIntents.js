import { z } from 'zod';
import { prisma } from './prisma.js';

// Phase 7 — "Admin natural-language reporting... deliberately deferred: a
// real injection/scope-leak risk that needs more careful design." This is
// that design: the LLM NEVER generates a query. It only classifies the
// admin's free-text question into one of the fixed intents below and
// extracts a small set of typed parameters (a class name hint, a
// threshold number, a status enum). Every one of those parameters is
// re-validated against a strict Zod schema server-side, and the actual
// data access is always one of the hand-written, parameterized Prisma
// queries below — the same shape of query every other admin screen in
// this app already runs. There is no code path from model output to raw
// SQL, a dynamic Prisma `where` built from unchecked keys, or any table
// outside what's defined here.
//
// If the model's output doesn't parse as JSON, doesn't name a known
// intent, or fails the intent's own param schema, the caller in
// ai.routes.js treats it as "unsupported" — it never falls back to
// executing anything looser.

const ATTENDANCE_DAYS_DEFAULT = 30;
const RESULT_ROW_CAP = 25;

async function resolveClass(hint) {
  if (!hint) return null;
  const trimmed = hint.trim();
  if (!trimmed) return null;
  const exact = await prisma.class.findFirst({ where: { name: { equals: trimmed, mode: 'insensitive' } } });
  if (exact) return exact;
  return prisma.class.findFirst({ where: { name: { contains: trimmed, mode: 'insensitive' } } });
}

function cap(rows) {
  return { rows: rows.slice(0, RESULT_ROW_CAP), truncated: rows.length > RESULT_ROW_CAP };
}

export const INTENTS = {
  attendance_below_threshold: {
    description:
      'Find active students whose attendance rate over a recent period is below a percentage threshold. Params: classHint (optional class name as mentioned in the question, e.g. "SSS2" — omit for all classes), thresholdPercent (1-100), days (7-180, defaults to 30 if not mentioned).',
    paramsSchema: z.object({
      classHint: z.string().trim().max(60).nullish(),
      thresholdPercent: z.number().min(1).max(100),
      days: z.number().int().min(7).max(180).nullish(),
    }),
    async execute(params) {
      const days = params.days ?? ATTENDANCE_DAYS_DEFAULT;
      const cls = await resolveClass(params.classHint);
      if (params.classHint && !cls) {
        return { unresolved: true, message: `I couldn't find a class matching "${params.classHint}".` };
      }

      const term = await prisma.term.findFirst({ where: { isCurrent: true } });
      if (!term) return { unresolved: true, message: 'No current term is set. Set one under Sessions & Terms first.' };

      const enrollments = await prisma.enrollment.findMany({
        where: { termId: term.id, status: 'ACTIVE', ...(cls ? { classId: cls.id } : {}) },
        include: { student: true, class: true },
      });
      const studentIds = enrollments.map((e) => e.studentId);

      const since = new Date();
      since.setUTCHours(0, 0, 0, 0);
      since.setUTCDate(since.getUTCDate() - (days - 1));

      const records = await prisma.attendanceRecord.findMany({
        where: { studentId: { in: studentIds }, date: { gte: since } },
        select: { studentId: true, status: true },
      });
      const byStudent = new Map();
      for (const r of records) {
        if (!byStudent.has(r.studentId)) byStudent.set(r.studentId, []);
        byStudent.get(r.studentId).push(r);
      }

      const rows = [];
      for (const e of enrollments) {
        const recs = byStudent.get(e.studentId) || [];
        if (recs.length === 0) continue;
        const rate = recs.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length / recs.length;
        const ratePercent = Math.round(rate * 100);
        if (ratePercent < params.thresholdPercent) {
          rows.push({
            name: `${e.student.firstName} ${e.student.lastName}`,
            admissionNumber: e.student.admissionNumber,
            className: e.class.name,
            attendancePercent: ratePercent,
          });
        }
      }
      rows.sort((a, b) => a.attendancePercent - b.attendancePercent);

      const { rows: capped, truncated } = cap(rows);
      return {
        unresolved: false,
        summaryFacts: `${rows.length} student(s) with attendance below ${params.thresholdPercent}% over the last ${days} days${cls ? ` in ${cls.name}` : ''}.`,
        rows: capped,
        truncated,
      };
    },
  },

  exam_average_below_threshold: {
    description:
      'Find students whose average score on a specific exam is below a threshold. Params: classHint (optional class name), examHint (optional exam name as mentioned, e.g. "First Term Examination" — if omitted, the most recent exam for the given class is used; classHint or examHint must resolve to a specific exam), thresholdScore (0-100).',
    paramsSchema: z.object({
      classHint: z.string().trim().max(60).nullish(),
      examHint: z.string().trim().max(80).nullish(),
      thresholdScore: z.number().min(0).max(100),
    }),
    async execute(params) {
      const cls = await resolveClass(params.classHint);
      if (params.classHint && !cls) {
        return { unresolved: true, message: `I couldn't find a class matching "${params.classHint}".` };
      }

      let exam;
      if (params.examHint) {
        exam = await prisma.exam.findFirst({
          where: { name: { contains: params.examHint, mode: 'insensitive' }, ...(cls ? { classId: cls.id } : {}) },
          orderBy: { createdAt: 'desc' },
          include: { class: true },
        });
        if (!exam) {
          return { unresolved: true, message: `I couldn't find an exam matching "${params.examHint}"${cls ? ` in ${cls.name}` : ''}.` };
        }
      } else if (cls) {
        exam = await prisma.exam.findFirst({ where: { classId: cls.id }, orderBy: { createdAt: 'desc' }, include: { class: true } });
        if (!exam) return { unresolved: true, message: `No exams found for ${cls.name} yet.` };
      } else {
        return { unresolved: true, message: 'Please mention a class or exam name so I know which exam to check.' };
      }

      const results = await prisma.result.findMany({ where: { examId: exam.id }, select: { studentId: true, score: true } });
      const byStudent = new Map();
      for (const r of results) {
        if (!byStudent.has(r.studentId)) byStudent.set(r.studentId, []);
        byStudent.get(r.studentId).push(r.score);
      }

      const studentIds = [...byStudent.keys()];
      const students = await prisma.student.findMany({ where: { id: { in: studentIds } } });
      const studentById = new Map(students.map((s) => [s.id, s]));

      const rows = [];
      for (const [studentId, scores] of byStudent) {
        const average = scores.reduce((a, b) => a + b, 0) / scores.length;
        if (average < params.thresholdScore) {
          const s = studentById.get(studentId);
          if (!s) continue;
          rows.push({ name: `${s.firstName} ${s.lastName}`, admissionNumber: s.admissionNumber, average: Math.round(average * 10) / 10 });
        }
      }
      rows.sort((a, b) => a.average - b.average);

      const { rows: capped, truncated } = cap(rows);
      return {
        unresolved: false,
        summaryFacts: `${rows.length} student(s) averaged below ${params.thresholdScore} in "${exam.name}" (${exam.class.name}).`,
        rows: capped,
        truncated,
      };
    },
  },

  fees_outstanding: {
    description:
      'List students with outstanding (unpaid or partially paid) fee invoices. Params: classHint (optional class name), status (optional: one of PENDING, PARTIALLY_PAID, OVERDUE, or ANY — defaults to ANY, meaning all non-PAID invoices).',
    paramsSchema: z.object({
      classHint: z.string().trim().max(60).nullish(),
      status: z.enum(['PENDING', 'PARTIALLY_PAID', 'OVERDUE', 'ANY']).nullish(),
    }),
    async execute(params) {
      const cls = await resolveClass(params.classHint);
      if (params.classHint && !cls) {
        return { unresolved: true, message: `I couldn't find a class matching "${params.classHint}".` };
      }
      const statusFilter = !params.status || params.status === 'ANY' ? ['PENDING', 'PARTIALLY_PAID', 'OVERDUE'] : [params.status];

      const invoices = await prisma.invoice.findMany({
        where: {
          status: { in: statusFilter },
          ...(cls ? { student: { currentClassId: cls.id } } : {}),
        },
        include: { student: { include: { currentClass: true } }, payments: true },
      });

      const rows = invoices.map((inv) => {
        const paid = inv.payments.reduce((sum, p) => sum + p.amount, 0);
        const outstandingNaira = Math.round((inv.amount - paid) / 100);
        return {
          name: `${inv.student.firstName} ${inv.student.lastName}`,
          admissionNumber: inv.student.admissionNumber,
          className: inv.student.currentClass?.name || 'Unassigned',
          outstandingNaira,
          status: inv.status,
        };
      });
      rows.sort((a, b) => b.outstandingNaira - a.outstandingNaira);
      const totalOutstanding = rows.reduce((sum, r) => sum + r.outstandingNaira, 0);

      const { rows: capped, truncated } = cap(rows);
      return {
        unresolved: false,
        summaryFacts: `${rows.length} invoice(s) outstanding${cls ? ` in ${cls.name}` : ''}, totaling ₦${totalOutstanding.toLocaleString()}.`,
        rows: capped,
        truncated,
      };
    },
  },

  class_roster_count: {
    description:
      'Count actively enrolled students, either for one class (classHint) or broken down across all classes if classHint is omitted.',
    paramsSchema: z.object({
      classHint: z.string().trim().max(60).nullish(),
    }),
    async execute(params) {
      const term = await prisma.term.findFirst({ where: { isCurrent: true } });
      if (!term) return { unresolved: true, message: 'No current term is set. Set one under Sessions & Terms first.' };

      if (params.classHint) {
        const cls = await resolveClass(params.classHint);
        if (!cls) return { unresolved: true, message: `I couldn't find a class matching "${params.classHint}".` };
        const count = await prisma.enrollment.count({ where: { termId: term.id, status: 'ACTIVE', classId: cls.id } });
        return {
          unresolved: false,
          summaryFacts: `${cls.name} has ${count} actively enrolled student(s) this term.`,
          rows: [{ className: cls.name, count }],
          truncated: false,
        };
      }

      const classes = await prisma.class.findMany({ orderBy: { sortOrder: 'asc' } });
      const rows = await Promise.all(
        classes.map(async (c) => ({
          className: c.name,
          count: await prisma.enrollment.count({ where: { termId: term.id, status: 'ACTIVE', classId: c.id } }),
        })),
      );
      const total = rows.reduce((sum, r) => sum + r.count, 0);
      return {
        unresolved: false,
        summaryFacts: `${total} actively enrolled student(s) across ${classes.length} classes this term.`,
        rows,
        truncated: false,
      };
    },
  },
};

export function buildIntentCatalogPrompt() {
  return Object.entries(INTENTS)
    .map(([name, def]) => `- "${name}": ${def.description}`)
    .join('\n');
}
