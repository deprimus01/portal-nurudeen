import { Router } from 'express';

import { prisma } from '../lib/prisma.js';
import { callGroq } from '../lib/groq.js';
import { computeReportCard } from '../lib/reportCard.js';
import { logAction } from '../lib/auditLog.js';
import { assertCanActOnClass } from '../lib/classAuthorization.js';
import { assertGuardianOwnsStudent } from '../lib/guardianOwnership.js';
import { getContacts } from '../lib/messageContacts.js';
import { resolveDraftContext } from '../lib/messageDraftContext.js';
import { computeFlags } from '../lib/flagging.js';
import { INTENTS, buildIntentCatalogPrompt } from '../lib/nlReportIntents.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { aiRateLimiter } from '../middleware/rateLimit.js';
import { validateBody, asyncHandler } from '../middleware/errorHandler.js';
import {
  reportCardCommentDraftSchema,
  saveReportCardCommentSchema,
  parentQaSchema,
  messageDraftSchema,
  nlReportSchema,
} from '../validation/ai.schema.js';

const router = Router();

router.use(requireAuth);

// ─────────────────────────────────────────────────────────────────────────
// Attendance/performance flagging — PRD Phase 7: proactive "this student
// is trending down" alerts. Deliberately mounted BEFORE the AI rate
// limiter below: this is a deterministic, rule-based computation (see
// lib/flagging.js) with no LLM call in it, so it shouldn't eat into the
// 30/hour budget that exists specifically to cap paid Groq usage.
// ─────────────────────────────────────────────────────────────────────────

router.get(
  '/flags',
  requireRole('ADMIN', 'TEACHER'),
  asyncHandler(async (req, res) => {
    const requestedClassId = typeof req.query.classId === 'string' && req.query.classId ? req.query.classId : null;

    let classIds;
    if (req.user.role === 'TEACHER') {
      const myClasses = await prisma.staffClass.findMany({ where: { staffId: req.user.staffId }, select: { classId: true } });
      const myClassIds = myClasses.map((c) => c.classId);
      if (requestedClassId) {
        await assertCanActOnClass(req.user, requestedClassId);
        classIds = [requestedClassId];
      } else {
        classIds = myClassIds;
      }
    } else if (requestedClassId) {
      classIds = [requestedClassId];
    }
    // else: Admin, no filter — classIds stays undefined, meaning all classes.

    const { term, flags, note } = await computeFlags(classIds);
    return res.json({ term: term ? { id: term.id, name: term.name } : null, flags, note });
  }),
);

router.use(aiRateLimiter);

// ─────────────────────────────────────────────────────────────────────────
// Report card comment generator — PRD Phase 7: "drafts narrative comments
// from entered scores/notes; teacher reviews and edits before it's
// published to the report card." This endpoint only ever returns a draft
// — nothing is saved here, and nothing an AI writes reaches a parent or
// student until a teacher/admin explicitly saves it via the PUT below.
// ─────────────────────────────────────────────────────────────────────────

router.post(
  '/report-card-comment/draft',
  requireRole('ADMIN', 'TEACHER'),
  validateBody(reportCardCommentDraftSchema),
  asyncHandler(async (req, res) => {
    const { examId, studentId } = req.body;

    const card = await computeReportCard(examId, studentId);
    if (!card) return res.status(404).json({ error: 'Exam or student not found.' });

    await assertCanActOnClass(req.user, card.exam.classId);

    const subjectLines = card.rows
      .map((r) => (r.score === null ? `${r.subject}: not yet entered` : `${r.subject}: ${r.score} (${r.grade}, ${r.remark})`))
      .join('\n');

    const systemPrompt = `You write short, warm, professional report card comments for a Nigerian secondary school. Base the comment ONLY on the scores provided — never invent behavior, attendance, or achievements not given to you. Keep it to 2-3 sentences: acknowledge overall performance, note a strength or area for improvement if the data supports one, and end on an encouraging, forward-looking note. Do not repeat every subject score verbatim — summarize.`;

    const userPrompt = `Student: ${card.student.name}\nExam: ${card.examSummary.name} (${card.examSummary.term}, ${card.examSummary.session})\nClass: ${card.examSummary.class}\nAverage: ${card.average ?? 'not yet available'}\n\nSubject scores:\n${subjectLines}`;

    const draft = await callGroq({ systemPrompt, userPrompt, maxTokens: 180 });

    await logAction({
      userId: req.user.id,
      action: 'ai.reportCardComment.draft',
      entityType: 'ReportCardComment',
      metadata: { examId, studentId },
    });

    return res.json({ draft });
  }),
);

router.put(
  '/report-card-comment',
  requireRole('ADMIN', 'TEACHER'),
  validateBody(saveReportCardCommentSchema),
  asyncHandler(async (req, res) => {
    const { examId, studentId, comment } = req.body;

    const exam = await prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) return res.status(404).json({ error: 'Exam not found.' });

    await assertCanActOnClass(req.user, exam.classId);

    const saved = await prisma.reportCardComment.upsert({
      where: { examId_studentId: { examId, studentId } },
      create: { examId, studentId, comment, authoredById: req.user.staffId },
      update: { comment, authoredById: req.user.staffId },
    });

    await logAction({
      userId: req.user.id,
      action: 'ai.reportCardComment.save',
      entityType: 'ReportCardComment',
      entityId: saved.id,
    });

    return res.json(saved);
  }),
);

// ─────────────────────────────────────────────────────────────────────────
// Parent Q&A assistant — PRD Phase 7: "answers questions using only that
// parent's own linked student data (read-only)." Guardian-only, ownership
// checked, and the context handed to the model is a compact snapshot the
// guardian is already authorized to see through other endpoints — this
// never queries anything beyond what GET /api/attendance/student/:id,
// GET /api/results/report-card, and GET /api/fees/invoices already expose
// to that same guardian.
// ─────────────────────────────────────────────────────────────────────────

router.post(
  '/parent-qa',
  requireRole('GUARDIAN'),
  validateBody(parentQaSchema),
  asyncHandler(async (req, res) => {
    const { studentId, question } = req.body;

    await assertGuardianOwnsStudent(req.user, studentId);

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { currentClass: true },
    });
    if (!student) return res.status(404).json({ error: 'Student not found.' });

    const attendance = await prisma.attendanceRecord.findMany({
      where: { studentId },
      orderBy: { date: 'desc' },
      take: 30,
    });
    const attendanceCounts = attendance.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {});

    let reportCardSummary = 'No exam results available yet.';
    if (student.currentClassId) {
      const latestExam = await prisma.exam.findFirst({
        where: { classId: student.currentClassId },
        orderBy: { createdAt: 'desc' },
      });
      if (latestExam) {
        const card = await computeReportCard(latestExam.id, studentId);
        if (card) {
          const lines = card.rows
            .filter((r) => r.score !== null)
            .map((r) => `${r.subject}: ${r.score} (${r.grade})`)
            .join(', ');
          reportCardSummary = `${card.examSummary.name} (${card.examSummary.term}): average ${card.average ?? 'pending'}. ${lines || 'No scores entered yet.'}`;
        }
      }
    }

    const invoices = await prisma.invoice.findMany({
      where: { studentId },
      include: { payments: true },
    });
    const feeSummary = invoices.length === 0
      ? 'No fee invoices on record.'
      : invoices
          .map((i) => {
            const paid = i.payments.reduce((sum, p) => sum + p.amount, 0);
            return `${(i.amount / 100).toLocaleString()} Naira invoice, ${(paid / 100).toLocaleString()} paid, status ${i.status}`;
          })
          .join('; ');

    const systemPrompt = `You are a helpful assistant for a parent using Nuruddeen Schools Gusau's parent portal. Answer ONLY using the data provided below about their child. Never guess, never invent information not given. If the question can't be answered from this data, say so plainly and suggest contacting the school office at +234 816 736 7179. Keep answers to 2-4 short sentences.`;

    const userPrompt = `Child: ${student.firstName} ${student.lastName}, Class: ${student.currentClass?.name || 'not assigned'}\n\nRecent attendance (last 30 records): ${JSON.stringify(attendanceCounts)}\n\nLatest results: ${reportCardSummary}\n\nFees: ${feeSummary}\n\nParent's question: ${question}`;

    const answer = await callGroq({ systemPrompt, userPrompt, maxTokens: 220 });

    await logAction({
      userId: req.user.id,
      action: 'ai.parentQa.ask',
      entityType: 'Student',
      entityId: studentId,
    });

    return res.json({ answer });
  }),
);

// ─────────────────────────────────────────────────────────────────────────
// Teacher/Admin message-drafting assistant — PRD Phase 7. Drafts a message
// body only; nothing is sent from here. The draft lands in the compose box
// on the frontend and goes through the normal POST /api/messages send
// path, which independently re-checks the contact boundary — this endpoint
// checking it too is about not wasting a Groq call on a message the
// sender wouldn't be allowed to send anyway, not the actual enforcement
// point.
// ─────────────────────────────────────────────────────────────────────────

router.post(
  '/message-draft',
  requireRole('ADMIN', 'TEACHER'),
  validateBody(messageDraftSchema),
  asyncHandler(async (req, res) => {
    const { recipientUserId, instruction } = req.body;

    const contacts = await getContacts(req.user);
    const recipient = contacts.find((c) => c.userId === recipientUserId);
    if (!recipient) {
      return res.status(403).json({ error: 'You can only draft messages to people in your contacts.' });
    }

    const context = await resolveDraftContext(req.user, recipientUserId);

    const systemPrompt = `You draft short, warm, professional messages for a staff member at a Nigerian school to send to ${recipient.subtitle === 'Parent/Guardian' ? 'a parent/guardian' : 'a colleague'} through the school portal's messaging feature. Write ONLY the message body — no subject line, no greeting salutation formatting beyond a natural opening, no signature block. Base any specific facts ONLY on the context given below; if no context is given, keep the message general and do not invent names, numbers, or events. Keep it to 2-4 sentences.`;

    const contextBlock = context
      ? `Regarding student: ${context.studentName} (${context.className})\nAttendance: ${context.attendanceSummary}\nResults: ${context.resultSummary}\nFees: ${context.feeSummary}\n\n`
      : '';

    const userPrompt = `${contextBlock}What the message should communicate: ${instruction}`;

    const draft = await callGroq({ systemPrompt, userPrompt, maxTokens: 200 });

    await logAction({
      userId: req.user.id,
      action: 'ai.messageDraft.draft',
      entityType: 'Message',
      metadata: { recipientUserId, hadStudentContext: Boolean(context) },
    });

    return res.json({ draft });
  }),
);

// ─────────────────────────────────────────────────────────────────────────
// Admin natural-language reporting — PRD Phase 7, previously deferred as
// "a real injection/scope-leak risk that needs more careful design." The
// design: the model only ever classifies the question into one of a fixed
// set of intents with typed params (see lib/nlReportIntents.js) — it never
// produces a query. Every param is re-validated with Zod; the actual data
// access is always one of the hand-written, parameterized Prisma queries
// in that file. A second, separate model call summarizes the already-
// computed, already-correct numbers into a sentence — it's told to use
// exactly what it's given, not to add anything — so the admin sees both
// the plain-language summary and the underlying table to verify it.
// ─────────────────────────────────────────────────────────────────────────

router.post(
  '/nl-report',
  requireRole('ADMIN'),
  validateBody(nlReportSchema),
  asyncHandler(async (req, res) => {
    const { question } = req.body;

    const classifyPrompt = `You classify a school administrator's question into exactly one supported report type, or none. Supported report types:\n${buildIntentCatalogPrompt()}\n\nRespond with ONLY a single JSON object and nothing else — no markdown fences, no explanation. If the question clearly matches one of the report types above, respond: {"intent": "<intent_name>", "params": { ... }}. Only include params the question actually mentions or clearly implies; omit optional params you're not sure about rather than guessing. If the question doesn't match any supported report type, respond: {"intent": "unsupported"}.`;

    const raw = await callGroq({ systemPrompt: classifyPrompt, userPrompt: question, maxTokens: 200 });

    let parsed;
    try {
      const cleaned = raw.replace(/^```json\s*|^```\s*|```\s*$/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = null;
    }

    const intentName = parsed?.intent;
    const intentDef = intentName ? INTENTS[intentName] : null;

    if (!parsed || !intentName || intentName === 'unsupported' || !intentDef) {
      await logAction({ userId: req.user.id, action: 'ai.nlReport.unsupported', entityType: 'Report', metadata: { question } });
      return res.json({
        supported: false,
        message:
          "I couldn't match that to a supported report. I can currently help with: attendance below a threshold, exam averages below a threshold, outstanding fees, and class roster counts.",
      });
    }

    const paramsResult = intentDef.paramsSchema.safeParse(parsed.params || {});
    if (!paramsResult.success) {
      await logAction({ userId: req.user.id, action: 'ai.nlReport.invalidParams', entityType: 'Report', metadata: { question, intent: intentName } });
      return res.json({
        supported: false,
        message: "I understood the type of report you wanted, but couldn't pin down the details (like a threshold number). Could you rephrase with a specific number or class?",
      });
    }

    const result = await intentDef.execute(paramsResult.data);

    if (result.unresolved) {
      return res.json({ supported: true, resolved: false, message: result.message });
    }

    const summarizePrompt = `You summarize pre-computed, already-correct school report data for an administrator in 2-3 short sentences. Use ONLY the facts given below — do not add, change, estimate, or invent any numbers or names. If the facts already read naturally, you may lightly rephrase for tone only.`;
    const summarizeUserPrompt = `Admin's question: ${question}\n\nComputed facts: ${result.summaryFacts}\n\nSample rows (already computed, for your reference only — do not recompute or alter): ${JSON.stringify(result.rows.slice(0, 10))}`;

    const summary = await callGroq({ systemPrompt: summarizePrompt, userPrompt: summarizeUserPrompt, maxTokens: 160 });

    await logAction({
      userId: req.user.id,
      action: 'ai.nlReport.run',
      entityType: 'Report',
      metadata: { question, intent: intentName, resultCount: result.rows.length },
    });

    return res.json({
      supported: true,
      resolved: true,
      summary,
      facts: result.summaryFacts,
      rows: result.rows,
      truncated: result.truncated,
    });
  }),
);

export default router;
