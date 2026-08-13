# Nuruddeen Schools Gusau - School Management System (Portal)

**Status: in progress.** Every phase from the original SMS PRD (0 through
7) is now built - including Phase 7 (AI Assistant), the last one on the
list. All four roles - Admin, Teacher, Guardian, and Student - have real
portals; the PRD only required Admin/Teacher at launch and called Student
"optional."

Separate project from the public website - own repo, own database, own
deployment. See the SMS PRD for full context.

## Structure

```
backend/    Express + Prisma + PostgreSQL API (deploy to Render)
frontend/   Next.js (App Router) + TypeScript admin/teacher portal (deploy to Vercel)
```

## What's working right now

- Full Prisma schema - every table from the PRD's data model (Phase 0)
- Invite-only auth: login, forced password reset on first login, JWT sessions
- Admin CRUD: students (with guardian linking/creation), guardians, staff,
  classes, subjects, academic sessions/terms, enrollments
- Guardian portal accounts auto-provisioned on student enrollment (per PRD
  §1.6) whenever an email is on file - temp password shown once in the UI
  for the admin to relay (SMS/email delivery is a later phase)
- Staff accounts provisioned directly on creation
- **Attendance (Phase 2)**: daily per-class roster entry, for both Admin
  (any class) and Teacher (own assigned classes only - enforced server-side,
  not just hidden in the UI). Upserts per student/date, so re-marking the
  same day updates rather than duplicates.
- **Timetable (Phase 2)**: click-to-edit weekly grid (Admin), read-only
  personal schedule across all assigned classes (Teacher). A cell is either
  a subject+teacher lesson or a free-text label ("Assembly", "Break").
- **Results & report cards (Phase 3)**: configurable grading schemes
  (nursery vs SSS can differ, per PRD), exam creation, per-subject score
  entry (Teacher restricted to subjects they're assigned via `StaffSubject`
  - enforced server-side), and a computed report card per student/exam
  showing score + resolved grade/remark per subject plus an average.
- **Fees & payments (Phase 4)**: fee structure line items per class/term,
  bulk invoice generation (one per actively-enrolled student, safe to
  re-run), and manual payment recording (Cash/Bank Transfer/Paystack/
  Flutterwave - recorded, not processed; no live payment gateway
  integration). Invoice status (`PENDING`/`PARTIALLY_PAID`/`PAID`)
  recomputes automatically from recorded payments. Admin-only to manage;
  Guardian gets read-only access scoped to their own linked children -
  matches the PRD's "View / pay fees: Admin Yes, Teacher No, Parent own
  child only" row exactly (Teacher genuinely has zero fee visibility, by
  design).
- **Announcements (Phase 5)**: Admin can post school-wide or class-specific
  notices; Teacher can only post to classes they're assigned to (`StaffClass`
  - enforced server-side, matching the PRD's "Post announcements: Teacher
  Yes (own classes)" row). Read side follows the same boundary for every
  role, including Guardian (school-wide + their child's class). Posting
  emails every guardian in scope in the background (see below).
- **Messaging (Phase 5)**: direct messages between Admin/Teacher/Guardian
  accounts, WhatsApp-style thread UI, now with real screens for all three
  roles (`/admin/messages`, `/teacher/messages`, `/guardian/messages`). Who
  you're allowed to message is enforced server-side
  (`GET /api/messages/contacts`), not just filtered in the UI: Admin ↔
  anyone with a portal account; Teacher ↔ colleagues + guardians of
  students in their own classes; Guardian ↔ staff teaching their child's
  class(es).
- **Guardian portal** (`/guardian`) is now real, not a placeholder:
  dashboard (linked children), attendance history, results/report cards,
  fee/invoice status, announcements, and messaging - all scoped server-side
  to students the guardian is actually linked to via `StudentGuardian`
  (`assertGuardianOwnsStudent` / `guardianStudentIds` in
  `backend/src/lib/guardianOwnership.js`), not just filtered client-side.
- **Email delivery (Phase 5)**: outbound email via Resend
  (`backend/src/lib/email.js`) - no SDK, just a `fetch` call against
  Resend's REST API. Wired into three places: guardian/staff temp-password
  delivery on account creation, guardian notification when an announcement
  is posted (fanned out in the background so posting doesn't wait on a
  batch of sends), and recipient notification on a new direct message.
  Every send attempt - success or failure - is written to
  `NotificationLog` (`channel: EMAIL`, `status: SENT | FAILED`, with
  `errorDetail` on failure) regardless of whether the email itself
  succeeds, so a bad address or missing API key never breaks the request
  that triggered it. SMS is intentionally still not wired up (Termii/
  Africa's Talking from the TRD) - email is the only automatic channel for
  now, per current scope.
- **Real teacher-facing portal** (`/teacher`) covers attendance, timetable,
  results entry, announcements, and messaging - the core of a teacher's
  daily portal use. Fees deliberately excluded (Teacher has no fee
  visibility per the PRD's own roles table).
- **Student portal** (`/student`) - new. Timetable, attendance history,
  results/report cards, and announcements, all read-only, all scoped to
  the student's own record server-side (same
  `assertCanViewStudentRecord` boundary Guardian uses, extended to cover
  "self" as well as "linked child"). No messaging for students - not a
  gap, the PRD's roles table explicitly excludes it ("Message teachers/
  parents: Student No").
- **Student account provisioning** - new, and different from every other
  role: students have no email field in the schema (most won't have a
  personal one), so a Student's login is a synthetic address on a
  configurable placeholder domain (`STUDENT_LOGIN_EMAIL_DOMAIN`, defaults
  to `students.portal.local` until the real domain exists - see
  Deployment) - a stable unique login handle, not a real mailbox. Because
  of that, account creation deliberately does **not** trigger
  `notifyNewAccount` the way guardian/staff provisioning does (sending to
  a fake address would just fail); the temp password is only ever shown
  once in the admin UI, same as before email delivery existed for the
  other roles. Admin triggers this per-student from the Students page
  ("Provision" button per row).
- **AI Assistant (Phase 7)** - now covers all five PRD-listed features, via
  Groq (`llama-3.3-70b-versatile`), using a **separate API key from the
  public website's chatbot** since this one touches real student data
  behind auth:
  - **Report card comment generator** (`/admin/report-cards`,
    `/teacher/report-cards` - the latter is new, teachers had no report
    card viewer at all before this) - drafts a short narrative comment
    from a student's actual entered scores. The draft is never saved
    automatically; a teacher/admin must review, optionally edit, and
    explicitly save it (`ReportCardComment` table, new) before it becomes
    visible to the guardian/student report card views. Restricted to
    classes the teacher is actually assigned to
    (`assertCanActOnClass`), same boundary as attendance/timetable.
  - **Parent Q&A** (`/guardian/ask`) - a guardian asks a free-text
    question about their child; the backend assembles a compact,
    already-authorized data snapshot (recent attendance counts, latest
    exam summary, fee/invoice status - nothing beyond what
    `/api/attendance`, `/api/results/report-card`, and `/api/fees/invoices`
    already expose to that same guardian) and the model answers strictly
    from that context, refusing to guess. Ownership-checked
    (`assertGuardianOwnsStudent`) same as every other guardian endpoint.
  - **Attendance/performance flagging** (`/admin/flags`, `/teacher/flags`)
    - proactive "this student is trending down" alerts. Deliberately
    **rule-based, not LLM-based** (`lib/flagging.js`): flags a ≥25-point
    attendance-rate drop between two 14-day windows, or a ≥15-point drop
    in exam average between a student's last two exams. No model call in
    this path at all - it can't hallucinate a decline that isn't in the
    data, and it costs nothing per request, so `GET /api/ai/flags` is
    mounted ahead of the `aiRateLimiter` rather than sharing its 30/hour
    budget. Teacher view auto-scoped to their assigned classes; Admin sees
    all classes or one via a filter.
  - **Teacher message-drafting assistant** (in `MessagesPanel`, teacher
    role only) - drafts a message body from a short instruction (e.g.
    "remind about outstanding fees"). If the recipient is a guardian with
    exactly one student the teacher can act on, the draft is grounded in
    that student's real attendance/results/fee snapshot, same
    never-invent pattern as Parent Q&A; otherwise it stays general rather
    than guessing. The contact-authorization check
    (`lib/messageContacts.js`, refactored out of `messages.routes.js` so
    both routes share one source of truth) is re-verified here - a
    teacher can only get a draft for someone they could actually message.
    Drafting never sends; the draft lands in the normal compose box, and
    the existing send endpoint re-checks the same boundary independently.
  - **Admin natural-language reporting** (`/admin/ai-reports`) - the one
    previously deferred for its injection/scope-leak risk. Resolved by
    never letting the model produce a query: it only classifies the
    admin's question into one of four whitelisted, parameterized report
    types (`lib/nlReportIntents.js` - attendance-below-threshold,
    exam-average-below-threshold, fees-outstanding, class-roster-count)
    and extracts a few typed parameters, every one of which is
    re-validated with Zod before any Prisma query runs. There is no code
    path from model output to raw SQL or a dynamically-built `where`
    clause. A second, separate model call turns the already-computed
    numbers into a one-paragraph summary, explicitly told not to alter
    them - the admin sees both that summary and the underlying table, so
    a wrong summary is easy to catch against the real numbers next to it.
    Unrecognized or unparseable questions fall back to a plain "couldn't
    match that" response, never a looser execution path.
  - All AI routes sit behind a dedicated `aiRateLimiter` (30/hour) *except*
    `/api/ai/flags*`, which is deterministic and free - see above.
- Role-based access enforced server-side on every route, not just hidden in
  the UI
- Audit log on every create/update/delete
- Rate limiting on login/password-reset/AI routes
- PWA manifest + minimal service worker (installable on Android)

## What's NOT built yet

- Online payment gateway integration (Paystack/Flutterwave) - payments are
  recorded manually by Admin right now, not collected through the portal
- SMS delivery (Termii/Africa's Talking from the TRD's tech stack table) -
  email via Resend is the only automatic notification channel, and even
  that doesn't apply to students (synthetic login address, never emailed)
- Invoice `OVERDUE` status is defined in the schema but never auto-set -
  nothing currently transitions a `PENDING` invoice past its due date; it'd
  need a scheduled job (cron) to sweep for this, not implemented

## Setup

### Backend

```bash
cd backend
npm install
cp .env.example .env   # fill in DATABASE_URL and JWT_SECRET
npx prisma migrate dev --name init   # creates the database tables (first run only)
npm run seed           # creates the first admin account - prints the temp password
npm run dev
```

> **When to run `prisma migrate dev` again:** only after you edit
> `prisma/schema.prisma` - never on every code change, and never for plain
> route/component edits. Run it as:
> ```bash
> npx prisma migrate dev --name describe_the_change
> ```
> `npx` (not a bare `prisma migrate dev`) matters - it runs the exact
> Prisma version pinned in this project's `package.json` instead of
> whatever (if anything) is installed globally on your machine.
>
> The first time you ever run `migrate dev` with no `prisma/migrations/`
> folder yet, Prisma has no history to diff against, so *any* existing
> data in that database counts as "drift" and it will drop and recreate
> the database from scratch. Once a `prisma/migrations/` folder exists
> (after that first run), `migrate dev` only resets if your actual
> database and the migration history have genuinely diverged (e.g. you
> hand-edited the DB outside Prisma, or deleted a migration file) - normal
> schema changes just add a new migration on top, no data loss.
>
> In production, use `npm run prisma:deploy` (`prisma migrate deploy`)
> instead - it only ever applies pending migrations forward and never
> resets, which is why it's the one wired into the Render build step (see
> Deployment below).

Email delivery needs a [Resend](https://resend.com) API key in `.env`
(`RESEND_API_KEY`). Without one, account creation/announcements/messages
still work exactly the same - the send attempt just fails, gets logged to
`NotificationLog` with `status: FAILED`, and the temp password / message
still shows up in the UI as a fallback. `EMAIL_FROM` defaults to Resend's
sandbox address (`onboarding@resend.dev`), which only delivers to your own
verified Resend account email until you verify a real sending domain.

> **Update:** `prisma migrate` and the full login → forced reset →
> dashboard flow have since been confirmed working end-to-end on a real
> Neon Postgres database, outside the sandbox this was built in (which
> couldn't reach `binaries.prisma.sh` and could only validate everything
> structurally). Phases 0–6 have real execution confidence now, not just
> syntax checks.
>
> **Phase 7 (AI Assistant) is the newly-added part and hasn't been through
> that same live-database test yet** - same validation as everything else
> before it (syntax-checked, backend boots cleanly, frontend type-checked
> and `next build` clean - that now covers all five AI routes, not just
> the original two), but the actual Groq calls, the new
> `ReportCardComment` table, and every AI flow's save/generate/draft/report
> path haven't been exercised against a running instance. The flagging
> endpoints (`/api/ai/flags`) don't call Groq at all, so they're lower-risk,
> but still unexercised against real attendance/result data. Worth running
> `npm run prisma:migrate` again after pulling this update (it adds one
> new table) before testing Phase 7 specifically.

**Before attendance will work**, you need at least one class with an
`isCurrent: true` term and active enrollments - the roster endpoint looks
up the current term automatically. Set one under Sessions & Terms.

**Timetable** just needs classes, subjects, and staff to exist - no term
dependency. Admin builds it under Timetable; a teacher only sees the slots
where they're the assigned staff member.

**Results** need, in order: a grading scheme (Grading Schemes), an exam
tied to a term/class/scheme (Exams), and subjects assigned to the class
(Class Subjects) so the report card knows which subjects to expect scores
for.

**Fees** need a fee structure (Fees page, one line item per class/term -
e.g. "Tuition") before invoices can be generated. Generate invoices per
class/term (safe to re-run), then record payments against them as they
come in. A guardian only sees invoices for their own linked children.

**Announcements** need nothing extra - Admin can post immediately; a
Teacher needs to be assigned to at least one class first (under Staff).

**Messaging** needs at least two portal accounts to exist. A Teacher's
available contacts are colleagues plus guardians of students in their own
classes, so enrollments + guardian linking need to exist first for that
list to be non-empty.

**Guardian portal** needs a guardian account linked to at least one student
(via `StudentGuardian`, auto-created on enrollment when the guardian has an
email on file - see Students) before there's anything to see.

**Student portal** needs an admin to click "Provision" on that student's
row under Students. The login is the synthetic address described above,
not the student's real email (they likely don't have one on file at all -
`Student` has no email field in the schema).

**AI Assistant** needs `GROQ_API_KEY` set (free key at
console.groq.com/keys). Without it, both AI routes respond with a clean
"not configured yet" error instead of crashing - safe to leave unset while
testing everything else. Report card comments need an exam + entered
scores to draft from; Parent Q&A works as soon as a guardian is linked to
a student, even with no attendance/results/fees data yet (it'll just say
so honestly rather than invent an answer).

**To test the teacher view**, create a staff record with role `TEACHER`
(or `TEACHER_ADMIN`) under Staff, assign them to a class, and log in with
the credentials the UI shows you after creating them.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local   # set NEXT_PUBLIC_API_URL to your backend
npm run dev
```

Open http://localhost:3000 - you'll land on the login page. Sign in with
the admin credentials the seed script printed, set a permanent password
when prompted, and you're in.

## Deployment

No custom domain needed to deploy - everything already runs off env vars,
not hardcoded URLs. Deploy now on Render/Vercel's default `.onrender.com`
/ `.vercel.app` addresses; connect the real domain later with zero code
changes.

- **Backend → Render**: set `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`
  (your Vercel URL, e.g. `https://your-app.vercel.app`), `RESEND_API_KEY`,
  `EMAIL_FROM`, and optionally `STUDENT_LOGIN_EMAIL_DOMAIN` (see
  `.env.example` - safe to leave at its placeholder default for now). Run
  `npm run prisma:deploy` as part of the build step (not `migrate dev`,
  which prompts interactively).
- **Frontend → Vercel**: set `NEXT_PUBLIC_API_URL` to the deployed
  backend's Render URL (e.g. `https://your-api.onrender.com`).
- **When the real domain is purchased**: add it in both Render's and
  Vercel's dashboard domain settings, update `FRONTEND_URL` and
  `NEXT_PUBLIC_API_URL` to the new URLs, and optionally set
  `STUDENT_LOGIN_EMAIL_DOMAIN` to something under the real domain. All
  three are env var changes only - no code touched.

NODE_OPTIONS=--dns-result-order=ipv4first npx prisma migrate dev --name init

npx prisma migrate deploy && npx prisma generate