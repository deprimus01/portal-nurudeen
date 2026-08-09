import { Router } from 'express';

import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateBody, asyncHandler } from '../middleware/errorHandler.js';
import { sendMessageSchema } from '../validation/messaging.schema.js';
import { notifyNewMessage } from '../lib/notify.js';
import { getContacts } from '../lib/messageContacts.js';

const router = Router();

router.use(requireAuth);

// Who a given user is allowed to message — this is the actual security
// boundary (checked again on POST /), not just what the UI offers to pick
// from. See lib/messageContacts.js for the PRD §2.4 rationale; it's shared
// with the AI message-drafting endpoint so both enforce the same rule.

router.get(
  '/contacts',
  requireRole('ADMIN', 'TEACHER', 'GUARDIAN'),
  asyncHandler(async (req, res) => {
    const contacts = await getContacts(req.user);
    contacts.sort((a, b) => a.name.localeCompare(b.name));
    return res.json(contacts);
  }),
);

// One row per conversation partner: their info, the most recent message,
// and how many are unread — the inbox list view.
router.get(
  '/conversations',
  requireRole('ADMIN', 'TEACHER', 'GUARDIAN'),
  asyncHandler(async (req, res) => {
    const userSelect = {
      id: true,
      role: true,
      staff: { select: { firstName: true, lastName: true, role: true } },
      guardian: { select: { firstName: true, lastName: true } },
    };

    const messages = await prisma.message.findMany({
      where: { OR: [{ senderId: req.user.id }, { recipientId: req.user.id }] },
      orderBy: { createdAt: 'desc' },
      include: { sender: { select: userSelect }, recipient: { select: userSelect } },
    });

    const conversations = new Map();
    for (const m of messages) {
      const isMine = m.senderId === req.user.id;
      const counterpart = isMine ? m.recipient : m.sender;
      const counterpartId = counterpart.id;

      if (!conversations.has(counterpartId)) {
        const profile = counterpart.staff || counterpart.guardian;
        conversations.set(counterpartId, {
          userId: counterpartId,
          name: profile ? `${profile.firstName} ${profile.lastName}` : 'Unknown',
          role: counterpart.role,
          lastMessage: m.body,
          lastMessageAt: m.createdAt,
          unreadCount: 0,
        });
      }
      if (!isMine && !m.readAt) {
        conversations.get(counterpartId).unreadCount += 1;
      }
    }

    return res.json([...conversations.values()]);
  }),
);

// Full history with one contact. Opening a thread also marks their
// messages to me as read, same as any chat app.
router.get(
  '/thread/:userId',
  requireRole('ADMIN', 'TEACHER', 'GUARDIAN'),
  asyncHandler(async (req, res) => {
    const otherUserId = req.params.userId;

    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: req.user.id, recipientId: otherUserId },
          { senderId: otherUserId, recipientId: req.user.id },
        ],
      },
      orderBy: { createdAt: 'asc' },
    });

    await prisma.message.updateMany({
      where: { senderId: otherUserId, recipientId: req.user.id, readAt: null },
      data: { readAt: new Date() },
    });

    return res.json(messages);
  }),
);

router.post(
  '/',
  requireRole('ADMIN', 'TEACHER', 'GUARDIAN'),
  validateBody(sendMessageSchema),
  asyncHandler(async (req, res) => {
    const { recipientUserId, body } = req.body;

    if (recipientUserId === req.user.id) {
      return res.status(400).json({ error: "You can't message yourself." });
    }

    const contacts = await getContacts(req.user);
    const allowed = contacts.some((c) => c.userId === recipientUserId);
    if (!allowed) {
      return res.status(403).json({ error: 'You can only message people in your contacts.' });
    }

    const message = await prisma.message.create({
      data: { senderId: req.user.id, recipientId: recipientUserId, body },
    });

    // Not awaited — the message is already saved and returned below;
    // don't make the sender wait on an outbound email round-trip.
    Promise.all([
      req.user.role === 'GUARDIAN'
        ? prisma.guardian.findUnique({ where: { id: req.user.guardianId }, select: { firstName: true, lastName: true } })
        : prisma.staff.findUnique({ where: { id: req.user.staffId }, select: { firstName: true, lastName: true } }),
      prisma.user.findUnique({
        where: { id: recipientUserId },
        include: {
          staff: { select: { firstName: true, lastName: true, phone: true } },
          guardian: { select: { firstName: true, lastName: true, phone: true } },
        },
      }),
    ])
      .then(([senderProfile, recipientUser]) => {
        if (!recipientUser || !senderProfile) return;
        const senderName = `${senderProfile.firstName} ${senderProfile.lastName}`;
        return notifyNewMessage({ recipientUser, senderName, body });
      })
      .catch(() => {});

    return res.status(201).json(message);
  }),
);

export default router;
