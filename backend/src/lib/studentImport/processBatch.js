import { prisma } from '../prisma.js';
import { extractFile } from './extract.js';
import { FileParseError } from './importErrors.js';
import { buildFieldMapping } from './fieldDictionary.js';
import { mapRawRow } from './mapRow.js';
import { matchClass } from './classMatcher.js';
import { matchGuardian } from './guardianMatcher.js';
import { findInFileDuplicates, findExactDbDuplicate, findFuzzyDbDuplicate } from './duplicateMatcher.js';
import { validateMappedRow } from './rowValidator.js';

// Converts the in-memory mapped+matched row into the JSON shape stored on
// ImportRecord.mappedData — Dates become ISO strings (JSON has no Date
// type), and the matched Class/Guardian are captured as plain id/name
// snapshots so the preview UI doesn't need extra lookups per row.
function serializeMappedData(m) {
  return {
    firstName: m.firstName,
    lastName: m.lastName,
    otherNames: m.otherNames || null,
    admissionNumber: m.admissionNumber,
    dateOfBirth: m.dateOfBirth ? m.dateOfBirth.toISOString() : null,
    gender: m.gender,
    classInput: m.classInput || null,
    matchedClassId: m.matchedClass?.id || null,
    matchedClassName: m.matchedClass?.name || null,
    guardianFirstName: m.guardianFirstName || null,
    guardianLastName: m.guardianLastName || null,
    guardianPhone: m.guardianPhone || null,
    guardianEmail: m.guardianEmail || null,
    guardianRelationship: m.guardianRelationship || 'GUARDIAN',
    matchedGuardianId: m.matchedGuardianId || null,
  };
}

// Runs detached from the request/response cycle (kicked off with
// setImmediate by the upload route) — large files and many DB lookups
// would exceed a synchronous request/response window otherwise (PRD/TRD
// §14: "Background Processing Considerations"). Batch status is persisted
// after every phase so a frontend polling GET /:batchId always sees real
// progress, and a page refresh never loses it.
export async function processImportBatch(batchId, fileBuffer, fileExt) {
  try {
    await prisma.importBatch.update({ where: { id: batchId }, data: { status: 'PARSING' } });

    const { headers, rows: rawRows } = await extractFile(fileBuffer, fileExt);
    const { mapping } = buildFieldMapping(headers);

    const classes = await prisma.class.findMany();
    const mappedRows = rawRows.map((raw) => mapRawRow(raw, mapping));
    const inFileDuplicateIndices = findInFileDuplicates(mappedRows);

    const records = [];

    for (let i = 0; i < mappedRows.length; i++) {
      const mapped = mappedRows[i];
      const { class: matchedClass } = matchClass(mapped.classInput, classes);
      const matchedGuardian = mapped.guardianPhone || mapped.guardianEmail
        ? await matchGuardian(prisma, { phone: mapped.guardianPhone, email: mapped.guardianEmail })
        : null;

      const resolved = { ...mapped, matchedClass, matchedGuardianId: matchedGuardian?.id || null };
      const { status: validationStatus, issues } = validateMappedRow(resolved);

      let status = validationStatus;
      const allIssues = [...issues];
      let matchedStudentId = null;

      if (inFileDuplicateIndices.has(i)) {
        status = 'ERROR';
        allIssues.push({
          field: 'admissionNumber',
          severity: 'error',
          message: 'This admission number appears more than once in the file.',
        });
      } else if (resolved.admissionNumber) {
        const exactDuplicate = await findExactDbDuplicate(prisma, resolved.admissionNumber);
        if (exactDuplicate) {
          status = 'ERROR';
          matchedStudentId = exactDuplicate.id;
          allIssues.push({
            field: 'admissionNumber',
            severity: 'error',
            message: 'A student with this admission number already exists.',
          });
        } else if (resolved.dateOfBirth) {
          const fuzzyDuplicate = await findFuzzyDbDuplicate(prisma, resolved);
          if (fuzzyDuplicate) {
            matchedStudentId = fuzzyDuplicate.id;
            if (status === 'OK') status = 'WARNING';
            allIssues.push({
              field: 'firstName',
              severity: 'warning',
              message: `Possible duplicate of existing student ${fuzzyDuplicate.firstName} ${fuzzyDuplicate.lastName} (${fuzzyDuplicate.admissionNumber}). Review before importing.`,
            });
          }
        }
      }

      records.push({
        batchId,
        rowNumber: i + 1,
        rawData: rawRows[i],
        mappedData: serializeMappedData(resolved),
        status,
        issues: allIssues,
        matchedStudentId,
        matchedGuardianId: matchedGuardian?.id || null,
      });
    }

    // createMany in one call rather than per-row awaits — a 1,000-row
    // batch would otherwise be 1,000 sequential round-trips just to stage
    // the preview.
    await prisma.importRecord.createMany({ data: records });

    await prisma.importBatch.update({
      where: { id: batchId },
      data: { status: 'PREVIEW_READY', totalRows: records.length },
    });
  } catch (err) {
    const message = err instanceof FileParseError ? err.message : 'This file could not be processed.';
    await prisma.importBatch
      .update({ where: { id: batchId }, data: { status: 'FAILED', totalRows: 0 } })
      .catch(() => {});
    // Full detail server-logged only — never surfaced to the client
    // (PRD/TRD §8, matching errorHandler.js's existing philosophy).
    console.error(`Import batch ${batchId} failed:`, err);
    await prisma.importRecord
      .create({
        data: {
          batchId,
          rowNumber: 0,
          rawData: {},
          mappedData: {},
          status: 'ERROR',
          issues: [{ field: null, severity: 'error', message }],
        },
      })
      .catch(() => {});
  }
}
