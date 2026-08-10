import { Router } from 'express';

import { prisma } from '../lib/prisma.js';
import { logAction } from '../lib/auditLog.js';
import { assertCanActOnClass } from '../lib/classAuthorization.js';
import { notifyAnnouncementRecipients } from '../lib/notify.js';
import { notifyAnnouncement } from '../lib/notifications.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateBody, asyncHandler } from '../middleware/errorHandler.js';
import { createAnnouncementSchema } from '../validation/messaging.schema.js';

const router = Router();

router.use(requireAuth);

const announcementInclude = {
  class: { select: { id: true, name: true } },
  authorStaff: { select: { id: true, firstName: true, lastName: true } },
};

// Admin sees everything. Teacher sees school-wide notices plus anything
// posted to a class they're assigned to. Guardian sees school-wide notices
// plus anything posted to a class their child(ren) are currently enrolled
// in — matches the PRD's "Post announcements: Teacher Yes (own classes)"
// row; the read side follows the same class boundary for every role
// rather than exposing every class's notices to everyone.
router.get(
  '/',
  requireRole('ADMIN', 'TEACHER', 'GUARDIAN', 'STUDENT'),
  asyncHandler(async (req, res) => {
    let where;

    if (req.user.role === 'ADMIN') {
      where = req.query.classId ? { classId: req.query.classId } : undefined;
    } else if (req.user.role === 'TEACHER') {
      const assignments = await prisma.staffClass.findMany({
        where: { staffId: req.user.staffId },
        select: { classId: true },
      });
      const classIds = assignments.map((a) => a.classId);
      where = {
        OR: [{ audience: 'SCHOOL_WIDE' }, { classId: { in: classIds } }],
      };
    } else if (req.user.role === 'STUDENT') {
      const student = await prisma.student.findUnique({ where: { id: req.user.studentId } });
      where = student?.currentClassId
        ? { OR: [{ audience: 'SCHOOL_WIDE' }, { classId: student.currentClassId }] }
        : { audience: 'SCHOOL_WIDE' };
    } else {
      const links = await prisma.studentGuardian.findMany({
        where: { guardianId: req.user.guardianId },
        include: { student: true },
      });
      const classIds = [...new Set(links.map((l) => l.student.currentClassId).filter(Boolean))];
      where = {
        OR: [{ audience: 'SCHOOL_WIDE' }, { classId: { in: classIds } }],
      };
    }

    const announcements = await prisma.announcement.findMany({
      where,
      include: announcementInclude,
      orderBy: { createdAt: 'desc' },
    });

    return res.json(announcements);
  }),
);

router.post(
  '/',
  requireRole('ADMIN', 'TEACHER'),
  validateBody(createAnnouncementSchema),
  asyncHandler(async (req, res) => {
    const { title, body, audience, classId } = req.body;

    // Teachers can only post school-wide notices as an admin — restrict
    // them to their own classes, enforced server-side per PRD §2.4.
    if (audience === 'SCHOOL_WIDE' && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only an admin can post a school-wide announcement.' });
    }

    if (audience === 'CLASS') {
      await assertCanActOnClass(req.user, classId);
    }

    const announcement = await prisma.announcement.create({
      data: {
        title,
        body,
        audience,
        classId: audience === 'CLASS' ? classId : null,
        authorStaffId: req.user.staffId,
      },
      include: announcementInclude,
    });

    await logAction({
      userId: req.user.id,
      action: 'announcement.create',
      entityType: 'Announcement',
      entityId: announcement.id,
      metadata: { audience, classId: announcement.classId },
    });

    // Not awaited on purpose — could be emailing an entire school's worth
    // of guardians. The announcement is already saved and returned below;
    // delivery happens in the background and each send is individually
    // logged to NotificationLog (see lib/notify.js).
    notifyAnnouncementRecipients(announcement);

    // In-app bell notification — separate write from the email/SMS fan-out
    // above, same fire-and-forget treatment.
    notifyAnnouncement({ actorUserId: req.user.id, announcement });

    return res.status(201).json(announcement);
  }),
);

router.delete(
  '/:id',
  requireRole('ADMIN', 'TEACHER'),
  asyncHandler(async (req, res) => {
    const announcement = await prisma.announcement.findUnique({ where: { id: req.params.id } });
    if (!announcement) return res.status(404).json({ error: 'Announcement not found.' });

    // A teacher can take down their own notice; only an admin can remove
    // someone else's.
    if (req.user.role !== 'ADMIN' && announcement.authorStaffId !== req.user.staffId) {
      return res.status(403).json({ error: 'You can only remove announcements you posted.' });
    }

    await prisma.announcement.delete({ where: { id: req.params.id } });

    await logAction({
      userId: req.user.id,
      action: 'announcement.delete',
      entityType: 'Announcement',
      entityId: req.params.id,
    });

    return res.json({ ok: true });
  }),
);

export default router;
