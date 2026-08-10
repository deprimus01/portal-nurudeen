import { prisma } from './prisma.js';
import { sendEmail } from './email.js';
import { sendSms } from './sms.js';
import { credentialEmail, passwordResetEmail, announcementEmail, newMessageEmail } from './emailTemplates.js';
import { credentialSms, passwordResetSms, announcementSms, newMessageSms } from './smsTemplates.js';

// Sends an email and records the outcome in NotificationLog. Never throws
// — a delivery failure should never break the request that triggered it
// (account creation, posting an announcement, sending a message), same
// fire-and-forget-safe philosophy as auditLog.js. Callers that care about
// the outcome can check the resolved boolean; nobody currently needs to.
async function notifyByEmail({ recipientType, recipientId, to, subject, html, text, logMessage }) {
  if (!to) {
    await prisma.notificationLog.create({
      data: {
        recipientType,
        recipientId,
        channel: 'EMAIL',
        message: logMessage,
        status: 'FAILED',
        errorDetail: 'No email address on file.',
      },
    });
    return false;
  }

  try {
    await sendEmail({ to, subject, html, text });
    await prisma.notificationLog.create({
      data: { recipientType, recipientId, channel: 'EMAIL', message: logMessage, status: 'SENT' },
    });
    return true;
  } catch (err) {
    await prisma.notificationLog.create({
      data: {
        recipientType,
        recipientId,
        channel: 'EMAIL',
        message: logMessage,
        status: 'FAILED',
        errorDetail: String(err?.message || err).slice(0, 500),
      },
    });
    return false;
  }
}

// Same contract as notifyByEmail (never throws, always logs), for SMS via
// Termii. Guardian/Staff.phone is a required field in the schema, so the
// "no phone on file" branch is a defensive fallback rather than an
// expected path — unlike email, which is genuinely optional for guardians.
async function notifyBySms({ recipientType, recipientId, to, message, logMessage }) {
  if (!to) {
    await prisma.notificationLog.create({
      data: {
        recipientType,
        recipientId,
        channel: 'SMS',
        message: logMessage,
        status: 'FAILED',
        errorDetail: 'No phone number on file.',
      },
    });
    return false;
  }

  try {
    await sendSms({ to, message });
    await prisma.notificationLog.create({
      data: { recipientType, recipientId, channel: 'SMS', message: logMessage, status: 'SENT' },
    });
    return true;
  } catch (err) {
    await prisma.notificationLog.create({
      data: {
        recipientType,
        recipientId,
        channel: 'SMS',
        message: logMessage,
        status: 'FAILED',
        errorDetail: String(err?.message || err).slice(0, 500),
      },
    });
    return false;
  }
}

// Fires both channels in parallel and never rejects, regardless of how
// either individual send resolves — callers of the four exported
// notify*() functions below don't need to know two channels exist.
// Either arg can be `null` (recipient opted out of that channel for this
// notification type) — that channel is simply skipped, not logged as a
// failure, since declining isn't an error.
async function notifyBoth({ email: emailArgs, sms: smsArgs }) {
  const results = await Promise.allSettled([
    emailArgs ? notifyByEmail(emailArgs) : Promise.resolve(false),
    smsArgs ? notifyBySms(smsArgs) : Promise.resolve(false),
  ]);
  return {
    emailSent: results[0].status === 'fulfilled' && results[0].value,
    smsSent: results[1].status === 'fulfilled' && results[1].value,
  };
}

// Called right after a guardian or staff User is provisioned. Awaited by
// the caller (it's on the same request that created the account) so the
// admin's UI can still show the temp password either way — this just
// adds "and we emailed/texted it too" on top, it never blocks account
// creation from succeeding.
export async function notifyNewAccount({ recipientType, recipientId, name, email, phone, tempPassword, accountType }) {
  const { subject, html, text } = credentialEmail({ name, email, tempPassword, accountType });
  const sms = credentialSms({ email, tempPassword, accountType });

  return notifyBoth({
    email: {
      recipientType,
      recipientId,
      to: email,
      subject,
      html,
      text,
      logMessage: `Portal account ready — temp password relayed by email to ${email}.`,
    },
    sms: {
      recipientType,
      recipientId,
      to: phone,
      message: sms,
      logMessage: `Portal account ready — temp password relayed by SMS to ${phone || 'unknown number'}.`,
    },
  });
}

// Called after an admin force-resets a user's password (see
// routes/users.routes.js). Same fire-and-forget-safe contract as
// notifyNewAccount — the admin's UI shows the temp password in the
// response either way, this just relays it by email and SMS too.
export async function notifyPasswordReset({ recipientType, recipientId, name, email, phone, tempPassword, accountType }) {
  const { subject, html, text } = passwordResetEmail({ name, email, tempPassword, accountType });
  const sms = passwordResetSms({ email, tempPassword, accountType });

  return notifyBoth({
    email: {
      recipientType,
      recipientId,
      to: email,
      subject,
      html,
      text,
      logMessage: `Password reset by admin — new temp password relayed by email to ${email}.`,
    },
    sms: {
      recipientType,
      recipientId,
      to: phone,
      message: sms,
      logMessage: `Password reset by admin — new temp password relayed by SMS to ${phone || 'unknown number'}.`,
    },
  });
}

function recipientRefForUser(user) {
  if (user.role === 'GUARDIAN') return { recipientType: 'guardian', recipientId: user.guardianId };
  if (user.role === 'STUDENT') return { recipientType: 'student', recipientId: user.studentId };
  return { recipientType: 'staff', recipientId: user.staffId };
}

// Fire-and-forget from the route: emails and texts every guardian in scope
// in parallel and never rejects, so `announcements.routes.js` can call this
// without awaiting it and still respond immediately, regardless of how
// many guardians are in the class (or school).
export async function notifyAnnouncementRecipients(announcement) {
  try {
    const guardianWhere =
      announcement.audience === 'SCHOOL_WIDE'
        ? { user: { isNot: null } }
        : {
            user: { isNot: null },
            studentGuardians: { some: { student: { currentClassId: announcement.classId } } },
          };

    const guardians = await prisma.guardian.findMany({ where: guardianWhere, include: { user: true } });

    const audienceLabel =
      announcement.audience === 'SCHOOL_WIDE'
        ? 'School-wide announcement'
        : `Announcement for ${announcement.class?.name || 'your child\u2019s class'}`;

    await Promise.allSettled(
      guardians.map((g) => {
        const { subject, html, text } = announcementEmail({
          recipientName: `${g.firstName} ${g.lastName}`,
          title: announcement.title,
          body: announcement.body,
          audienceLabel,
        });
        const sms = announcementSms({ title: announcement.title, audienceLabel });

        return notifyBoth({
          email: g.user.notifyEmailAnnouncements
            ? {
                recipientType: 'guardian',
                recipientId: g.id,
                to: g.user.email,
                subject,
                html,
                text,
                logMessage: `Announcement "${announcement.title}" emailed to ${g.user.email}.`,
              }
            : null,
          sms: g.user.notifySmsAnnouncements
            ? {
                recipientType: 'guardian',
                recipientId: g.id,
                to: g.phone,
                message: sms,
                logMessage: `Announcement "${announcement.title}" texted to ${g.phone || 'unknown number'}.`,
              }
            : null,
        });
      }),
    );
  } catch {
    // Swallow — this runs detached from the request/response cycle.
  }
}

// Fire-and-forget from the route: one email and one SMS to the recipient
// of a new direct message.
export async function notifyNewMessage({ recipientUser, senderName, body }) {
  try {
    const profile = recipientUser.staff || recipientUser.guardian;
    if (!profile) return;

    const { subject, html, text } = newMessageEmail({
      recipientName: `${profile.firstName} ${profile.lastName}`,
      senderName,
      preview: body.length > 300 ? `${body.slice(0, 300)}\u2026` : body,
    });
    const sms = newMessageSms({ senderName });

    await notifyBoth({
      email: recipientUser.notifyEmailMessages
        ? {
            ...recipientRefForUser(recipientUser),
            to: recipientUser.email,
            subject,
            html,
            text,
            logMessage: `New message from ${senderName} emailed to ${recipientUser.email}.`,
          }
        : null,
      sms: recipientUser.notifySmsMessages
        ? {
            ...recipientRefForUser(recipientUser),
            to: profile.phone,
            message: sms,
            logMessage: `New message from ${senderName} texted to ${profile.phone || 'unknown number'}.`,
          }
        : null,
    });
  } catch {
    // Swallow — this runs detached from the request/response cycle.
  }
}
