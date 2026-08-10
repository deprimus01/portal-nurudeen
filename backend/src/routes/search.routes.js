import { Router } from 'express';

import { prisma } from '../lib/prisma.js';
import { guardianStudentIds } from '../lib/guardianOwnership.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

router.use(requireAuth);

// Per-category cap — this powers an instant, ambient "as you type" search,
// not a full results browser. Keeping each category small keeps every
// query fast and keeps the dropdown scannable. Full record management
// stays on each entity's own list page, which this only links out to.
const CATEGORY_LIMIT = 6;
const MIN_QUERY_LENGTH = 2;

const SCHOOL_LEVEL_LABELS = {
  NURSERY: 'Nursery',
  PRIMARY: 'Primary',
  JUNIOR_SECONDARY: 'Junior Secondary',
  SENIOR_SECONDARY: 'Senior Secondary',
};

const STAFF_ROLE_LABELS = {
  TEACHER: 'Teacher',
  ADMIN: 'Admin',
  TEACHER_ADMIN: 'Teacher & Admin',
};

const INVOICE_STATUS_LABELS = {
  PENDING: 'Unpaid',
  PARTIALLY_PAID: 'Partially paid',
  PAID: 'Paid',
  OVERDUE: 'Overdue',
};

function insensitiveContains(field, q) {
  return { [field]: { contains: q, mode: 'insensitive' } };
}

// ── Students, guardians, staff, classes, subjects ──────────────────────
// Directory pages for these only exist for Admin today (Staff is also
// admin-only at the API level - see staff.routes.js), so search is scoped
// to Admin here even though the underlying Student/Guardian/Class/Subject
// APIs also allow Teacher — there'd be nowhere useful to send a Teacher's
// click. Nothing here relaxes what those APIs already permit.

async function searchStudents(q) {
  const students = await prisma.student.findMany({
    where: {
      OR: [
        insensitiveContains('firstName', q),
        insensitiveContains('lastName', q),
        insensitiveContains('admissionNumber', q),
      ],
    },
    include: { currentClass: true },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    take: CATEGORY_LIMIT,
  });

  return students.map((s) => ({
    type: 'STUDENT',
    id: s.id,
    title: `${s.firstName} ${s.lastName}`,
    subtitle: s.currentClass?.name || 'Unassigned',
    meta: s.admissionNumber,
  }));
}

async function searchGuardians(q) {
  const guardians = await prisma.guardian.findMany({
    where: {
      OR: [insensitiveContains('firstName', q), insensitiveContains('lastName', q), insensitiveContains('phone', q)],
    },
    include: { studentGuardians: { include: { student: true } } },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    take: CATEGORY_LIMIT,
  });

  return guardians.map((g) => ({
    type: 'GUARDIAN',
    id: g.id,
    title: `${g.firstName} ${g.lastName}`,
    subtitle: g.phone,
    meta: g.studentGuardians.map((sg) => `${sg.student.firstName} ${sg.student.lastName}`).join(', ') || 'No linked students',
  }));
}

async function searchStaff(q) {
  const staff = await prisma.staff.findMany({
    where: {
      OR: [insensitiveContains('firstName', q), insensitiveContains('lastName', q), insensitiveContains('employeeId', q)],
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    take: CATEGORY_LIMIT,
  });

  return staff.map((s) => ({
    type: 'STAFF',
    id: s.id,
    title: `${s.firstName} ${s.lastName}`,
    subtitle: STAFF_ROLE_LABELS[s.role] || s.role,
    meta: s.employeeId,
  }));
}

async function searchClasses(q) {
  const classes = await prisma.class.findMany({
    where: insensitiveContains('name', q),
    orderBy: { sortOrder: 'asc' },
    take: CATEGORY_LIMIT,
  });

  return classes.map((c) => ({
    type: 'CLASS',
    id: c.id,
    title: c.name,
    subtitle: SCHOOL_LEVEL_LABELS[c.level] || c.level,
  }));
}

async function searchSubjects(q) {
  const subjects = await prisma.subject.findMany({
    where: { OR: [insensitiveContains('name', q), insensitiveContains('code', q)] },
    orderBy: { name: 'asc' },
    take: CATEGORY_LIMIT,
  });

  return subjects.map((s) => ({
    type: 'SUBJECT',
    id: s.id,
    title: s.name,
    subtitle: s.code || 'Subject',
  }));
}

// ── Exams ────────────────────────────────────────────────────────────
// Matches exams.routes.js GET / exactly: Admin/Teacher, unfiltered by
// class assignment (that route has no per-teacher scoping either).

async function searchExams(q) {
  const exams = await prisma.exam.findMany({
    where: insensitiveContains('name', q),
    include: { class: true, term: true },
    orderBy: { createdAt: 'desc' },
    take: CATEGORY_LIMIT,
  });

  return exams.map((e) => ({
    type: 'EXAM',
    id: e.id,
    title: e.name,
    subtitle: [e.class?.name, e.term?.name].filter(Boolean).join(' · '),
    examId: e.id,
  }));
}

// ── Results / report cards ──────────────────────────────────────────
// Results have no title of their own, so a match is a student, subject,
// or exam name that leads to a specific student+exam report card.
// Deduped to one entry per (exam, student) pair.

function dedupeResultRows(rows, keyFn, mapFn) {
  const seen = new Set();
  const items = [];
  for (const row of rows) {
    const key = keyFn(row);
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(mapFn(row));
    if (items.length >= CATEGORY_LIMIT) break;
  }
  return items;
}

async function searchResultsForStaff(q) {
  const results = await prisma.result.findMany({
    where: {
      OR: [
        { student: { firstName: { contains: q, mode: 'insensitive' } } },
        { student: { lastName: { contains: q, mode: 'insensitive' } } },
        { student: { admissionNumber: { contains: q, mode: 'insensitive' } } },
        { subject: { name: { contains: q, mode: 'insensitive' } } },
        { exam: { name: { contains: q, mode: 'insensitive' } } },
      ],
    },
    include: { student: true, exam: { include: { class: true } } },
    orderBy: { createdAt: 'desc' },
    take: 40,
  });

  return dedupeResultRows(
    results,
    (r) => `${r.examId}:${r.studentId}`,
    (r) => ({
      type: 'RESULT',
      id: `${r.examId}:${r.studentId}`,
      title: `${r.student.firstName} ${r.student.lastName}`,
      subtitle: `${r.exam.name} · ${r.exam.class?.name || ''} report card`,
      examId: r.examId,
      studentId: r.studentId,
    }),
  );
}

async function searchResultsForGuardian(q, user) {
  const studentIds = await guardianStudentIds(user);
  if (studentIds.length === 0) return [];

  const results = await prisma.result.findMany({
    where: {
      studentId: { in: studentIds },
      OR: [
        { student: { firstName: { contains: q, mode: 'insensitive' } } },
        { student: { lastName: { contains: q, mode: 'insensitive' } } },
        { subject: { name: { contains: q, mode: 'insensitive' } } },
        { exam: { name: { contains: q, mode: 'insensitive' } } },
      ],
    },
    include: { student: true, exam: true },
    orderBy: { createdAt: 'desc' },
    take: 40,
  });

  return dedupeResultRows(
    results,
    (r) => `${r.examId}:${r.studentId}`,
    (r) => ({
      type: 'RESULT',
      id: `${r.examId}:${r.studentId}`,
      title: `${r.student.firstName} ${r.student.lastName}`,
      subtitle: `${r.exam.name} · Report card`,
      examId: r.examId,
      studentId: r.studentId,
    }),
  );
}

async function searchResultsForStudent(q, user) {
  if (!user.studentId) return [];

  const results = await prisma.result.findMany({
    where: {
      studentId: user.studentId,
      OR: [{ subject: { name: { contains: q, mode: 'insensitive' } } }, { exam: { name: { contains: q, mode: 'insensitive' } } }],
    },
    include: { exam: true },
    orderBy: { createdAt: 'desc' },
    take: 40,
  });

  return dedupeResultRows(
    results,
    (r) => r.examId,
    (r) => ({
      type: 'RESULT',
      id: r.examId,
      title: r.exam.name,
      subtitle: 'Your report card',
      examId: r.examId,
      studentId: user.studentId,
    }),
  );
}

// ── Announcements ───────────────────────────────────────────────────
// Reuses the exact visibility rule from announcements.routes.js GET /,
// AND'd with a title/body text match.

async function announcementVisibilityWhere(user) {
  if (user.role === 'ADMIN') return {};

  if (user.role === 'TEACHER') {
    const assignments = await prisma.staffClass.findMany({ where: { staffId: user.staffId }, select: { classId: true } });
    const classIds = assignments.map((a) => a.classId);
    return { OR: [{ audience: 'SCHOOL_WIDE' }, { classId: { in: classIds } }] };
  }

  if (user.role === 'STUDENT') {
    const student = await prisma.student.findUnique({ where: { id: user.studentId } });
    return student?.currentClassId
      ? { OR: [{ audience: 'SCHOOL_WIDE' }, { classId: student.currentClassId }] }
      : { audience: 'SCHOOL_WIDE' };
  }

  // GUARDIAN
  const links = await prisma.studentGuardian.findMany({
    where: { guardianId: user.guardianId },
    include: { student: true },
  });
  const classIds = [...new Set(links.map((l) => l.student.currentClassId).filter(Boolean))];
  return { OR: [{ audience: 'SCHOOL_WIDE' }, { classId: { in: classIds } }] };
}

async function searchAnnouncements(q, user) {
  const visibilityWhere = await announcementVisibilityWhere(user);
  const textWhere = { OR: [insensitiveContains('title', q), insensitiveContains('body', q)] };

  const announcements = await prisma.announcement.findMany({
    where: { AND: [visibilityWhere, textWhere] },
    include: { class: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
    take: CATEGORY_LIMIT,
  });

  return announcements.map((a) => ({
    type: 'ANNOUNCEMENT',
    id: a.id,
    title: a.title,
    subtitle: a.audience === 'SCHOOL_WIDE' ? 'Whole school' : a.class?.name || 'Class',
  }));
}

// ── Messages ─────────────────────────────────────────────────────────
// One entry per conversation partner whose thread with this user contains
// a matching message — mirrors the dedupe-by-counterpart logic in
// messages.routes.js GET /conversations.

async function searchMessages(q, user) {
  const userSelect = {
    id: true,
    staff: { select: { firstName: true, lastName: true } },
    guardian: { select: { firstName: true, lastName: true } },
  };

  const messages = await prisma.message.findMany({
    where: {
      OR: [{ senderId: user.id }, { recipientId: user.id }],
      body: { contains: q, mode: 'insensitive' },
    },
    orderBy: { createdAt: 'desc' },
    include: { sender: { select: userSelect }, recipient: { select: userSelect } },
    take: 40,
  });

  return dedupeResultRows(
    messages,
    (m) => (m.senderId === user.id ? m.recipientId : m.senderId),
    (m) => {
      const isMine = m.senderId === user.id;
      const counterpart = isMine ? m.recipient : m.sender;
      const profile = counterpart.staff || counterpart.guardian;
      return {
        type: 'MESSAGE',
        id: counterpart.id,
        title: profile ? `${profile.firstName} ${profile.lastName}` : 'Unknown',
        subtitle: m.body.length > 60 ? `${m.body.slice(0, 60)}…` : m.body,
        userId: counterpart.id,
      };
    },
  );
}

// ── Fees ─────────────────────────────────────────────────────────────
// Matches fees.routes.js access exactly: Admin sees everything, Guardian
// sees only invoices for their own linked students.

async function searchFeesAdmin(q) {
  const [invoices, structures] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        OR: [
          { student: { firstName: { contains: q, mode: 'insensitive' } } },
          { student: { lastName: { contains: q, mode: 'insensitive' } } },
          { student: { admissionNumber: { contains: q, mode: 'insensitive' } } },
        ],
      },
      include: { student: true, term: true },
      orderBy: { createdAt: 'desc' },
      take: CATEGORY_LIMIT,
    }),
    prisma.feeStructure.findMany({
      where: insensitiveContains('description', q),
      include: { class: true },
      orderBy: { createdAt: 'desc' },
      take: 3,
    }),
  ]);

  const invoiceItems = invoices.map((i) => ({
    type: 'FEE',
    id: i.id,
    title: `${i.student?.firstName || ''} ${i.student?.lastName || ''}`.trim() || 'Invoice',
    subtitle: `${i.term?.name || ''} · ${INVOICE_STATUS_LABELS[i.status] || i.status}`,
    studentId: i.studentId,
  }));

  const structureItems = structures.map((s) => ({
    type: 'FEE',
    id: s.id,
    title: s.description,
    subtitle: `${s.class?.name || ''} fee structure`.trim(),
  }));

  return [...invoiceItems, ...structureItems].slice(0, CATEGORY_LIMIT);
}

async function searchFeesGuardian(q, user) {
  const studentIds = await guardianStudentIds(user);
  if (studentIds.length === 0) return [];

  const invoices = await prisma.invoice.findMany({
    where: {
      studentId: { in: studentIds },
      OR: [
        { student: { firstName: { contains: q, mode: 'insensitive' } } },
        { student: { lastName: { contains: q, mode: 'insensitive' } } },
      ],
    },
    include: { student: true, term: true },
    orderBy: { createdAt: 'desc' },
    take: CATEGORY_LIMIT,
  });

  return invoices.map((i) => ({
    type: 'FEE',
    id: i.id,
    title: `${i.student?.firstName || ''} ${i.student?.lastName || ''}`.trim(),
    subtitle: `${i.term?.name || ''} · ${INVOICE_STATUS_LABELS[i.status] || i.status}`,
    studentId: i.studentId,
  }));
}

// ── Aggregator ───────────────────────────────────────────────────────

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = (req.query.q || '').toString().trim();

    if (q.length < MIN_QUERY_LENGTH) {
      return res.json({ query: q, results: [] });
    }

    const user = req.user;
    const tasks = [];

    if (user.role === 'ADMIN') {
      tasks.push(searchStudents(q), searchGuardians(q), searchStaff(q), searchClasses(q), searchSubjects(q));
    }

    if (user.role === 'ADMIN' || user.role === 'TEACHER') {
      tasks.push(searchExams(q), searchResultsForStaff(q));
    }

    if (user.role === 'GUARDIAN') {
      tasks.push(searchResultsForGuardian(q, user));
    }

    if (user.role === 'STUDENT') {
      tasks.push(searchResultsForStudent(q, user));
    }

    tasks.push(searchAnnouncements(q, user));

    if (user.role === 'ADMIN' || user.role === 'TEACHER' || user.role === 'GUARDIAN') {
      tasks.push(searchMessages(q, user));
    }

    if (user.role === 'ADMIN') {
      tasks.push(searchFeesAdmin(q));
    }

    if (user.role === 'GUARDIAN') {
      tasks.push(searchFeesGuardian(q, user));
    }

    // Every category is independently fault-tolerant — one bad query
    // (e.g. a role edge case) drops that category instead of failing the
    // whole search.
    const settled = await Promise.allSettled(tasks);
    const results = settled.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));

    return res.json({ query: q, results });
  }),
);

export default router;
