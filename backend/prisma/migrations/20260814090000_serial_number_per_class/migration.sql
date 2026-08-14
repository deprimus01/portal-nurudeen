-- This school numbers students sequentially within each class (e.g. "1",
-- "2", "3" — reused across classes), not with a single school-wide unique
-- code. Drop the old global uniqueness and replace it with a composite
-- constraint scoped to (currentClassId, admissionNumber).
--
-- Note: Postgres treats each NULL as distinct in a unique index, so two
-- students with no class assigned (currentClassId IS NULL) could share
-- the same serial number without conflict. That's expected here — a
-- student isn't meaningfully "duplicate" until they're both placed in
-- the same class.
--
-- Safe against existing data: admissionNumber was previously globally
-- unique, so no two existing rows can already collide under the new,
-- looser composite constraint.

DROP INDEX "Student_admissionNumber_key";

CREATE UNIQUE INDEX "Student_currentClassId_admissionNumber_key" ON "Student"("currentClassId", "admissionNumber");
