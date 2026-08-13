-- Smart Student Import (Phase 1: Excel/CSV) — staging tables only.
-- Nothing here is a system of record: ImportRecord holds raw + mapped
-- data as JSON until a human confirms the batch, at which point real
-- Student/Guardian/User rows are created via the existing shared
-- creation logic (lib/createStudent.js). No FK cascade from
-- ImportRecord to Student — createdStudentId is a soft reference.

-- CreateEnum
CREATE TYPE "ImportBatchStatus" AS ENUM ('UPLOADED', 'PARSING', 'PREVIEW_READY', 'COMMITTING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ImportRecordStatus" AS ENUM ('OK', 'WARNING', 'ERROR', 'IMPORTED', 'SKIPPED');

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id"           TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "fileName"     TEXT NOT NULL,
    "fileType"     TEXT NOT NULL,
    "sourcePhase"  TEXT NOT NULL,
    "status"       "ImportBatchStatus" NOT NULL DEFAULT 'UPLOADED',
    "totalRows"    INTEGER,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount"  INTEGER NOT NULL DEFAULT 0,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt"  TIMESTAMP(3),
    "expiresAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportRecord" (
    "id"                TEXT NOT NULL,
    "batchId"           TEXT NOT NULL,
    "rowNumber"         INTEGER NOT NULL,
    "rawData"           JSONB NOT NULL,
    "mappedData"        JSONB NOT NULL,
    "status"            "ImportRecordStatus" NOT NULL,
    "issues"            JSONB,
    "matchedStudentId"  TEXT,
    "matchedGuardianId" TEXT,
    "createdStudentId"  TEXT,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImportBatch_uploadedById_createdAt_idx" ON "ImportBatch"("uploadedById", "createdAt");

-- CreateIndex
CREATE INDEX "ImportRecord_batchId_status_idx" ON "ImportRecord"("batchId", "status");

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportRecord" ADD CONSTRAINT "ImportRecord_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
