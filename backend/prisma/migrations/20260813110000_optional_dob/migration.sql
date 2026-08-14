-- This school does not collect date of birth at enrollment (Smart
-- Student Import + the manual Add Student form no longer require it).
-- Existing rows keep whatever value they already have; new rows may
-- omit it entirely.

ALTER TABLE "Student" ALTER COLUMN "dateOfBirth" DROP NOT NULL;
