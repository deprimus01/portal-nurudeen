import { Router } from 'express';

import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

router.use(requireAuth);

// Surfaces the NotificationLog table — previously write-only from the
// admin's perspective (see lib/notify.js: every send/failure is logged,
// but nothing ever read it back). Without this, a misconfigured sender
// (e.g. Resend's sandbox address, which can only deliver to the account
// owner's own inbox) fails silently: the request that triggered the email
// still succeeds, so there's no error anywhere in the UI — just a staff
// member who never got their credentials.
router.get(
  '/log',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const { status, limit } = req.query;
    const take = Math.min(Number(limit) || 50, 200);

    const entries = await prisma.notificationLog.findMany({
      where: status ? { status: String(status).toUpperCase() } : undefined,
      orderBy: { sentAt: 'desc' },
      take,
    });

    const failedCount = await prisma.notificationLog.count({ where: { status: 'FAILED' } });

    return res.json({ entries, failedCount });
  }),
);

function startOfDay(date) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

// Attendance reminders are computed live rather than stored — a teacher
// who hasn't marked a class yet today needs to see that reflect the
// current moment, not a row written once and then stale. Not persisted,
// so it has no read/unread state of its own; the panel surfaces it as an
// action item rather than a dismissible notification.
async function attendanceReminders(user) {
  if (user.role !== 'TEACHER') return [];

  const term = await prisma.term.findFirst({ where: { isCurrent: true } });
  if (!term) return [];

  const assignments = await prisma.staffClass.findMany({
    where: { staffId: user.staffId },
    include: { class: { select: { id: true, name: true } } },
  });
  if (assignments.length === 0) return [];

  const today = startOfDay(new Date());

  const reminders = [];
  for (const a of assignments) {
    const enrolledCount = await prisma.enrollment.count({
      where: { classId: a.classId, termId: term.id, status: 'ACTIVE' },
    });
    if (enrolledCount === 0) continue;

    const markedCount = await prisma.attendanceRecord.count({
      where: { classId: a.classId, date: today },
    });

    if (markedCount === 0) {
      reminders.push({
        id: `reminder-attendance-${a.classId}`,
        type: 'attendance-reminder',
        title: 'Attendance reminder',
        body: `Attendance hasn't been marked for ${a.class.name} today.`,
        entityType: 'Class',
        entityId: a.classId,
      });
    }
  }
  return reminders;
}

// Bell / dropdown feed. Persisted notifications for this user, newest
// first, plus any live-computed reminders — kept as two separate arrays
// so the client can render reminders as action items rather than mixing
// them into the read/unread list.
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const take = Math.min(Number(req.query.limit) || 30, 100);

    const [notifications, unreadCount, reminders] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: 'desc' },
        take,
      }),
      prisma.notification.count({ where: { userId: req.user.id, read: false } }),
      attendanceReminders(req.user),
    ]);

    return res.json({ notifications, unreadCount, reminders });
  }),
);

router.patch(
  '/:id/read',
  asyncHandler(async (req, res) => {
    const notification = await prisma.notification.findUnique({ where: { id: req.params.id } });
    if (!notification || notification.userId !== req.user.id) {
      return res.status(404).json({ error: 'Notification not found.' });
    }

    const updated = await prisma.notification.update({
      where: { id: req.params.id },
      data: { read: true, readAt: new Date() },
    });

    return res.json(updated);
  }),
);

router.post(
  '/read-all',
  asyncHandler(async (req, res) => {
    await prisma.notification.updateMany({
      where: { userId: req.user.id, read: false },
      data: { read: true, readAt: new Date() },
    });
    return res.json({ ok: true });
  }),
);

// ─────────────────────────────────────────────────────────────────────────
// Activity timeline — reads AuditLog (previously write-only from the API's
// perspective; see components/dashboard/ActivityFeedWidget.tsx's old
// workaround of composing a feed from unrelated list endpoints instead).
// Admin gets the full school-wide feed; a teacher gets their own actions
// plus activity on their assigned classes, so both match the "WHO did
// WHAT, WHEN" shape from the PRD without either role seeing data it
// otherwise couldn't.
// ─────────────────────────────────────────────────────────────────────────

const ACTION_VERBS = {
  'enrollment.create': 'enrolled a student',
  'enrollment.update': 'updated an enrollment',
  'staff.create': 'added a new staff member',
  'staff.update': 'updated a staff record',
  'student.create': 'registered a new student',
  'student.update': 'updated a student record',
  'guardian.create': 'added a guardian',
  'guardian.update': 'updated a guardian record',
  'announcement.create': 'posted an announcement',
  'announcement.delete': 'removed an announcement',
  'feeStructure.create': 'created a fee structure',
  'invoice.generate': 'generated invoices',
  'payment.record': 'recorded a fee payment',
  'results.mark': 'entered results',
  'attendance.mark': 'recorded attendance',
  'exam.create': 'scheduled an exam',
  'class.create': 'created a class',
  'class.update': 'updated a class',
  'subject.create': 'created a subject',
  'term.create': 'created a term',
  'gradingScheme.create': 'created a grading scheme',
  'timetable.update': 'updated the timetable',
  'user.resetPassword': "reset a user's password",
};

function describeActivity(entry, classNameById) {
  const verb = ACTION_VERBS[entry.action] || entry.action.replace(/\./g, ' ');
  const meta = entry.metadata || {};
  let detail = verb;

  if (entry.action === 'attendance.mark' && meta.classId) {
    detail = `recorded attendance for ${classNameById.get(meta.classId) || 'a class'}`;
  } else if (entry.action === 'announcement.create') {
    detail = meta.classId
      ? `posted an announcement for ${classNameById.get(meta.classId) || 'a class'}`
      : 'posted a school-wide announcement';
  } else if (entry.action === 'invoice.generate' && meta.classId) {
    detail = `generated ${meta.count ?? ''} invoice${meta.count === 1 ? '' : 's'} for ${classNameById.get(meta.classId) || 'a class'}`.replace('  ', ' ');
  } else if (entry.action === 'payment.record' && meta.amount) {
    detail = `recorded a fee payment of \u20a6${Math.round(meta.amount / 100).toLocaleString()}`;
  } else if (entry.action === 'results.mark' && meta.count) {
    detail = `entered results for ${meta.count} student${meta.count === 1 ? '' : 's'}`;
  }

  return detail;
}

router.get(
  '/activity',
  requireRole('ADMIN', 'TEACHER'),
  asyncHandler(async (req, res) => {
    const take = Math.min(Number(req.query.limit) || 20, 100);

    // School-wide for both roles — a teacher sees the same activity feed
    // as admin, not just their own actions/classes.
    const rawEntries = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        user: {
          select: {
            role: true,
            staff: { select: { firstName: true, lastName: true, role: true } },
            guardian: { select: { firstName: true, lastName: true } },
            email: true,
          },
        },
      },
    });

    const classIds = [...new Set(rawEntries.map((e) => e.metadata?.classId).filter(Boolean))];
    const classes = classIds.length
      ? await prisma.class.findMany({ where: { id: { in: classIds } }, select: { id: true, name: true } })
      : [];
    const classNameById = new Map(classes.map((c) => [c.id, c.name]));

    const activity = rawEntries.map((entry) => {
      const profile = entry.user.staff || entry.user.guardian;
      const actorName = profile
        ? `${entry.user.staff?.role === 'ADMIN' ? 'Admin' : entry.user.staff ? 'Teacher' : 'Guardian'} ${profile.firstName}`
        : entry.user.email;

      return {
        id: entry.id,
        actorName,
        detail: describeActivity(entry, classNameById),
        entityType: entry.entityType,
        entityId: entry.entityId,
        createdAt: entry.createdAt,
      };
    });

    return res.json({ activity });
  }),
);

export default router;
