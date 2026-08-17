-- Phase 3 visual verification. The original uploaded file (image or PDF)
-- is stored once per batch directly in Postgres — deliberately not in an
-- external object-storage service; see SMART_STUDENT_IMPORT_PRD_TRD.docx
-- for why. sourceFileBytes is cleared to null as soon as it's no longer
-- needed (immediately after commit or cancel), not just at the existing
-- 7-day expiresAt purge, since it's student PII and only useful
-- pre-commit.
--
-- fieldBoxes on ImportRecord is lightweight by design: coordinates only,
-- never a duplicated image — the frontend crops the one stored batch
-- image using these coordinates per field.

ALTER TABLE "ImportBatch" ADD COLUMN "sourceFileBytes" BYTEA;
ALTER TABLE "ImportBatch" ADD COLUMN "sourceFileMimeType" TEXT;

ALTER TABLE "ImportRecord" ADD COLUMN "fieldBoxes" JSONB;
