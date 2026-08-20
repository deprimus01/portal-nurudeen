// Student login handle generation.
//
// This school doesn't track admission/serial numbers, so student logins
// are no longer derived from one (see students.routes.js's old
// `admissionNumber@students.portal.local` pattern). Instead: lowercased
// firstname+lastname on a fixed domain, e.g. "John Doe" -> johndoe@student.nurudeen.
//
// Like the pattern it replaces, this is NOT a real, deliverable email
// address - "student.nurudeen" isn't a domain the school owns or sends
// mail through. It's a login handle shaped like an email only because the
// existing auth system (User.email, unique) expects that format. The UI
// must never imply a student should "check their email" for this.
//
// Frozen at creation: called once, at provision-account time, and never
// regenerated - not on class promotion, not on a later name correction -
// so a login/password already given to a family never silently breaks.

// Strips everything except a-z0-9 - handles spaces, hyphens, apostrophes,
// and anything else in a name without needing to special-case each one.
function sanitizeNamePart(value) {
  return (value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Domain is env-configurable (same reasoning as the admission-number
// pattern it replaces) so this doesn't need a code change if the school
// ever wants a different placeholder domain - defaults to the one product
// decided on.
export function studentLoginDomain() {
  return process.env.STUDENT_LOGIN_EMAIL_DOMAIN || 'student.nurudeen';
}

// Generates a globally-unique login handle for a student, appending an
// incrementing number on collision (johndoe, johndoe2, johndoe3, ...).
// Collision-checked school-wide - not per-class - since the domain no
// longer encodes class, the full handle is what must be unique for login.
export async function generateStudentLoginEmail(prisma, firstName, lastName) {
  const domain = studentLoginDomain();
  const base = `${sanitizeNamePart(firstName)}${sanitizeNamePart(lastName)}`;

  let candidate = `${base}@${domain}`;
  let suffix = 2;
  // Small, sequential, one-at-a-time check - fine at school scale, and
  // keeps the logic simple and obviously correct rather than trying to
  // batch-guess a free suffix.
  while (await prisma.user.findUnique({ where: { email: candidate } })) {
    candidate = `${base}${suffix}@${domain}`;
    suffix += 1;
  }
  return candidate;
}
