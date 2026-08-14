-- Phase 4: AI-assisted field mapping. These columns exist purely for
-- transparency in the preview UI and Import History — they record
-- whether/which headers were mapped via an AI suggestion rather than the
-- deterministic synonym dictionary, so a reviewer knows to double-check
-- those specific columns. Never used to decide what gets written to
-- Student/Guardian; that's still entirely the normal preview→commit path.

ALTER TABLE "ImportBatch" ADD COLUMN "aiMappingUsed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ImportBatch" ADD COLUMN "aiMappedFields" JSONB;
