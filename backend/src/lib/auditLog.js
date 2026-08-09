import { prisma } from './prisma.js';

// PRD §2.4 — "Admin action audit log (who changed what, when)". Call this
// from every route that creates/updates/deletes a record. Deliberately
// fire-and-forget-safe: a logging failure should never block the actual
// operation, so callers await it but the route itself should not fail if
// this throws (wrap in try/catch at the call site if paranoid).
export async function logAction({ userId, action, entityType, entityId, metadata }) {
  return prisma.auditLog.create({
    data: {
      userId,
      action,
      entityType,
      entityId: entityId ?? null,
      metadata: metadata ?? undefined,
    },
  });
}
