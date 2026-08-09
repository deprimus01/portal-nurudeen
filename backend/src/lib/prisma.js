import { PrismaClient } from '@prisma/client';

// Standard singleton pattern for dev (avoids exhausting DB connections
// across hot-reloads) — harmless in production where this module only
// ever loads once per process anyway.
const globalForPrisma = globalThis;

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
