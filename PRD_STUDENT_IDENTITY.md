# PRD: Student Identity Without Admission Numbers

**Project:** Portal Nurudeen (Nuruddeen Schools Gusau)
**Status:** Fully implemented (4.1–4.4).
**Owner:** Deprimus

## 1. Background

Nuruddeen Schools Gusau does not use admission numbers or serial numbers to
identify students. Students and pupils are identified only by **full name +
class**. The current system was built around a required `admissionNumber`
field that:

- Is shown as "Serial number" in the Students admin form and table
- Is required in the Student Import feature (template, mapping, preview,
  OCR/image parsing, and duplicate-matching)
- Is the basis for student login credentials
  (`admissionNumber@students.portal.local`)
- Is the database-level uniqueness key for a student within a class

None of this matches how the school actually operates, and admin staff are
forced to invent serial numbers that don't exist in the school's own
records.

## 2. Goals

1. No admin, teacher, or staff member should ever see, type, or think
   about a "serial number" anywhere in the product.
2. Students remain uniquely identifiable in the database and able to log
   in, without requiring any number the school doesn't already track.
3. Two students with the same name in the same class must remain
   individually addressable — in the data model, in login credentials, and
   (pending a follow-up decision) visually in lists.

## 3. Non-goals

- This does not change how **teachers**, **guardians**, or **admin staff**
  log in — only student accounts are affected.
- This does not remove `admissionNumber` from the database. It becomes an
  internal, auto-generated, invisible field — not a user-facing concept.

## 4. Changes

### 4.1 Remove "serial number" from the UI entirely

- **Students admin form** (`frontend/app/admin/students/page.tsx`) —
  remove the "Serial number" input field.
- **Students admin table** — remove the "Serial number" column.
- **Student Import feature** — remove every reference, across:
  - The downloadable import template
  - Upload, column-mapping, and preview steps
  - OCR / scanned-image parsing (`ocr.js`, `parseImageTable.js`,
    `parseScannedPdf.js`, `tableReconstruction.js`)
  - Duplicate-matching logic (currently matches on admission number within
    a class; must be re-derived from name + class + possibly DOB instead)

### 4.2 Keep `admissionNumber` internally, but auto-generated and invisible

- `admissionNumber` remains in the `Student` model as the DB-level
  uniqueness key within a class (existing `@@unique([currentClassId,
  admissionNumber])` constraint stays).
- On student creation, it is **auto-assigned server-side** — next
  available number within that class — the same pattern already used for
  auto-assigning `Class.sortOrder`. No admin ever enters it.
- It is no longer used to construct login credentials (see 4.3).

### 4.3 New student login handle

Replaces `admissionNumber@students.portal.local`.

- **Format:** `firstname` + `lastname`, lowercased, with spaces, hyphens,
  and apostrophes stripped.
  Example: "Mary-Jane O'Brien" → `maryjaneobrien`
- **Domain:** fixed `@student.nurudeen` (not tied to class or session).
  Example: `johndoe@student.nurudeen`
- **Collisions:** if the resulting handle already exists **anywhere in the
  school** (not just within one class — the domain no longer encodes
  class, so the full handle must be globally unique), append an
  incrementing number: `johndoe2@student.nurudeen`,
  `johndoe3@student.nurudeen`, etc.
- **Frozen at creation:** the handle is generated once and never
  regenerated — not on class promotion, not on a later name correction.
  This avoids invalidating a login/password combination already
  communicated to a family.
- **Not a deliverable email address.** Like the pattern it replaces, this
  is a login handle shaped like an email because the auth system expects
  that format — `nurudeen` is not a domain the school owns or sends mail
  through. The UI must never imply students should "check their email."

### 4.4 Visual disambiguation of same-named students — **decided**

Two students can legitimately share an identical displayed name within a
class (e.g. two "John Doe" in JSS1). Decision:

- **Auto-tag only on collision.** Names that don't collide with anyone
  else in their class are shown exactly as-is — no decoration, no extra
  info, matching how the school actually thinks about its students.
- When a collision exists, order the colliding students by enrollment
  order (i.e. `admissionNumber` ascending, since it's auto-assigned
  sequentially at creation — see 4.2). The first-enrolled student is shown
  plain; each subsequent one gets a small suffix: `John Doe`, `John Doe ·
  2`, `John Doe · 3`, etc.
- Rejected: always showing date of birth next to every name. `dateOfBirth`
  is optional on `Student` and isn't even collected by the Import
  template — most rows would show nothing useful, defeating the purpose.

**Status: implemented.** Applied everywhere a class roster or student name
list renders: `AttendanceEntry.tsx` and `ResultsEntry.tsx` (replaced the
old `admissionNumber` column entirely), report cards (`reportCard.js` /
`ReportCardView.tsx`), search results (`search.routes.js`), AI-generated
reports (`nlReportIntents.js`), and flagging (`flagging.js`). Guardian and
student portal profile pages and Settings simply had the raw admission
number removed (no tag needed — single-student views, nothing to
disambiguate against). Shared logic lives in
`backend/src/lib/nameDisambiguation.js`.

Known minor gap: the student picker in `admin/enrollments/page.tsx`
previously showed only current class, not a tag — closed by computing
`nameTag` once in the shared `GET /api/students` list endpoint (scoped by
`currentClassId`, which naturally groups never-yet-enrolled students —
`currentClassId: null` — together too) and consuming it from both the
Enrollments picker and the core Students admin table, which had the same
latent gap for two same-named students in the same class.

## 5. Risks / things to watch

- **Auth migration:** existing students already have accounts under the
  old `admissionNumber@students.portal.local` pattern. This PRD does not
  yet define a migration path for existing accounts — new logins, a
  bulk-regeneration job, or leaving old accounts as-is going forward all
  have different tradeoffs and need a decision before rollout.
- **Duplicate-matching in Import:** currently keyed partly on admission
  number; needs a new strategy (likely name + class + DOB) that doesn't
  reintroduce a false sense of certainty when names collide.
- **Global uniqueness check performance:** checking "does this handle
  exist anywhere in the school" on every student creation needs an
  indexed lookup on the login field to stay fast as enrollment grows.

## 6. Out of scope for this PRD

- The visual disambiguation mechanism (4.4) — to be decided separately.
- Any changes to teacher, guardian, or admin authentication.
- Migration strategy for already-existing student accounts.
