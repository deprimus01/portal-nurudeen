// Wraps a Zod schema as Express middleware — validates req.body and
// replaces it with the parsed (typed, trimmed, defaulted) result, or
// responds 400 with the first validation issue.
export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      return res.status(400).json({
        error: firstIssue?.message || 'Invalid request body.',
        field: firstIssue?.path?.join('.'),
      });
    }
    req.body = result.data;
    next();
  };
}

// Catches errors thrown/rejected inside async route handlers and forwards
// them to Express's error handler, instead of crashing the process.
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Prisma's known-error codes we want to turn into clean 4xx responses
// instead of leaking a raw 500 + stack trace.

// Raw Prisma field names aren't fit for a user-facing message (e.g. a
// composite unique constraint's err.meta.target might be
// ['currentClassId', 'admissionNumber']) — humanized here so any current
// or future unique constraint across the app reads naturally instead of
// leaking column names.
const FRIENDLY_FIELD_NAMES = {
  admissionNumber: 'serial number',
  currentClassId: 'class',
  email: 'email',
  phone: 'phone number',
  employeeId: 'employee ID',
};

function humanizeFields(rawFields) {
  const humanized = rawFields.map((f) => FRIENDLY_FIELD_NAMES[f] || f);
  if (humanized.length === 1) return humanized[0];
  return `${humanized.slice(0, -1).join(', ')} and ${humanized[humanized.length - 1]}`;
}

function mapPrismaError(err) {
  if (err.code === 'P2002') {
    const rawFields = err.meta?.target || [];
    const fields = rawFields.length ? humanizeFields(rawFields) : 'details';
    return { status: 409, error: `A record with this ${fields} already exists.` };
  }
  if (err.code === 'P2025') {
    return { status: 404, error: 'Record not found.' };
  }
  return null;
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err.statusCode) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  const prismaMapped = mapPrismaError(err);
  if (prismaMapped) {
    return res.status(prismaMapped.status).json({ error: prismaMapped.error });
  }

  console.error(err);
  return res.status(500).json({ error: 'Something went wrong on our end.' });
}
