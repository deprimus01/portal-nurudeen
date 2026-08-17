import { prisma } from '../prisma.js';
import { extractFile } from './extract.js';
import { FileParseError } from './importErrors.js';
import { buildFieldMapping } from './fieldDictionary.js';
import { suggestAiFieldMappings } from './aiFieldMapper.js';
import { mapRawRow, SLOT_TO_RESOLVED_FIELDS } from './mapRow.js';
import { matchClass } from './classMatcher.js';
import { matchGuardian } from './guardianMatcher.js';
import { findInFileDuplicates, findExactDbDuplicate, findFuzzyDbDuplicate } from './duplicateMatcher.js';
import { validateMappedRow } from './rowValidator.js';

const SOURCE_MIME_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.pdf': 'application/pdf', // stored as the original PDF even when scanned — pages are rendered on-demand by the source route, not pre-rendered and stored separately
};

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
export async function processImportBatch(batchId, fileBuffer, fileExt, uploadedById) {
  try {
    await prisma.importBatch.update({ where: { id: batchId }, data: { status: 'PARSING' } });

    const { headers, rows: rawRows, usedOcr, rowConfidences, cellBoxesByRow, pageByRow } = await extractFile(fileBuffer, fileExt);
    const { mapping, unmapped } = buildFieldMapping(headers);

    // Phase 4: only engages for headers the deterministic dictionary
    // couldn't place, and its suggestions are merged into the same
    // `mapping` used everywhere else — every AI-mapped field still goes
    // through the normal preview/correction step like any other field
    // (PRD/TRD §3, §18.5). Batch-level disclosure (aiMappingUsed /
    // aiMappedFields) is recorded below so the preview UI can flag it.
    const aiResult = await suggestAiFieldMappings({
      userId: uploadedById,
      unmappedHeaders: unmapped,
      claimedFields: new Set(Object.values(mapping)),
    });
    const finalMapping = { ...mapping, ...aiResult.mapping };

    const classes = await prisma.class.findMany();
    const mappedRows = rawRows.map((raw) => mapRawRow(raw, finalMapping));

    // Class must be resolved before duplicate detection, since serial
    // numbers are only unique *within* a class (e.g. "3" legitimately
    // exists in both JSS1 and JSS2) — the old flow ran duplicate
    // detection first using bare serial numbers, which would have
    // wrongly flagged every same-numbered row across different classes
    // as a collision.
    const classResolvedRows = mappedRows.map((mapped) => {
      const { class: matchedClass } = matchClass(mapped.classInput, classes);
      return { ...mapped, matchedClass, matchedClassId: matchedClass?.id || null };
    });
    const inFileDuplicateIndices = findInFileDuplicates(classResolvedRows);

    const records = [];

    for (let i = 0; i < classResolvedRows.length; i++) {
      const mapped = classResolvedRows[i];
      const matchedGuardian = mapped.guardianPhone || mapped.guardianEmail
        ? await matchGuardian(prisma, { phone: mapped.guardianPhone, email: mapped.guardianEmail })
        : null;

      const resolved = { ...mapped, matchedGuardianId: matchedGuardian?.id || null };
      const { status: validationStatus, issues } = validateMappedRow(resolved);

      let status = validationStatus;
      const allIssues = [...issues];
      let matchedStudentId = null;

      if (inFileDuplicateIndices.has(i)) {
        status = 'ERROR';
        allIssues.push({
          field: 'admissionNumber',
          severity: 'error',
          message: 'This serial number appears more than once in this class within the file.',
        });
      } else if (resolved.admissionNumber && resolved.matchedClassId) {
        const exactDuplicate = await findExactDbDuplicate(prisma, resolved.admissionNumber, resolved.matchedClassId);
        if (exactDuplicate) {
          status = 'ERROR';
          matchedStudentId = exactDuplicate.id;
          allIssues.push({
            field: 'admissionNumber',
            severity: 'error',
            message: 'A student with this serial number already exists in this class.',
          });
        } else if (resolved.dateOfBirth) {
          const fuzzyDuplicate = await findFuzzyDbDuplicate(prisma, resolved);
          if (fuzzyDuplicate) {
            matchedStudentId = fuzzyDuplicate.id;
            if (status === 'OK') status = 'WARNING';
            allIssues.push({
              field: 'firstName',
              severity: 'warning',
              message: `Possible duplicate of existing student ${fuzzyDuplicate.firstName} ${fuzzyDuplicate.lastName} (serial ${fuzzyDuplicate.admissionNumber}). Review before importing.`,
            });
          }
        }
      } else if (resolved.admissionNumber && resolved.dateOfBirth) {
        // Class didn't resolve — the row is already ERROR-flagged for
        // that by validateMappedRow, and a per-class serial-number check
        // isn't meaningful without a class. Fuzzy name+DOB matching still
        // runs since it doesn't depend on class/serial at all.
        const fuzzyDuplicate = await findFuzzyDbDuplicate(prisma, resolved);
        if (fuzzyDuplicate) {
          matchedStudentId = fuzzyDuplicate.id;
          if (status === 'OK') status = 'WARNING';
          allIssues.push({
            field: 'firstName',
            severity: 'warning',
            message: `Possible duplicate of existing student ${fuzzyDuplicate.firstName} ${fuzzyDuplicate.lastName} (serial ${fuzzyDuplicate.admissionNumber}). Review before importing.`,
          });
        }
      }

      // Phase 3: an OCR-derived row is never allowed to silently pass as
      // OK, regardless of how clean its individual fields look — OCR can
      // misread a character in a way that still happens to validate
      // (e.g. "JSS1" misread as "JSS!" could still resolve to a
      // near-match class). PRD/TRD's risk mitigation is explicit: "every
      // OCR'd row is flagged for human verification... low-confidence
      // rows never auto-pass." The row's actual OCR confidence is
      // surfaced in the message so a reviewer knows how much scrutiny it
      // needs, rather than treating every OCR row identically.
      if (usedOcr) {
        if (status === 'OK') status = 'WARNING';
        const confidence = rowConfidences?.[i];
        const confidenceNote = typeof confidence === 'number'
          ? `This row was read from a scanned document (${Math.round(confidence)}% OCR confidence) — please verify every field against the original.`
          : 'This row was read from a scanned document — please verify every field against the original.';
        allIssues.push({ field: null, severity: 'warning', message: confidenceNote });
      }

      // Phase 3 visual verification: attach each resolved field to the
      // OCR bounding box of the header it was read from. A slot that
      // splits into multiple resolved fields (e.g. one "Student Name"
      // column → firstName + lastName) attaches the same box to each —
      // there's no finer-grained position data telling "Ahmad" apart
      // from "Musa" within one cell's bounding box, and both fields
      // legitimately point at that same source-image region. Value
      // shown is the raw, un-normalized OCR text for that header (not
      // the post-normalization value) so a reviewer sees literally what
      // OCR read, which is what they're actually verifying against the
      // image.
      let fieldBoxes = null;
      if (usedOcr) {
        const cellBoxes = cellBoxesByRow?.[i] || {};
        const page = pageByRow?.[i] || 1;
        const boxes = [];
        for (const [header, slot] of Object.entries(finalMapping)) {
          const boxInfo = cellBoxes[header];
          if (!boxInfo) continue;
          const rawValue = rawRows[i][header];
          for (const fieldName of SLOT_TO_RESOLVED_FIELDS[slot] || []) {
            boxes.push({
              field: fieldName,
              value: rawValue !== undefined ? String(rawValue) : '',
              bbox: boxInfo.bbox,
              confidence: Math.round(boxInfo.confidence),
              page,
            });
          }
        }
        fieldBoxes = boxes;
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
        fieldBoxes,
      });
    }

    // createMany in one call rather than per-row awaits — a 1,000-row
    // batch would otherwise be 1,000 sequential round-trips just to stage
    // the preview.
    await prisma.importRecord.createMany({ data: records });

    await prisma.importBatch.update({
      where: { id: batchId },
      data: {
        status: 'PREVIEW_READY',
        totalRows: records.length,
        // A .pdf upload only resolves to OCR at runtime (scanned
        // fallback) — correct the extension-based guess made at upload
        // time (sourcePhaseForExt) if that's what actually happened.
        sourcePhase: usedOcr ? 'ocr' : undefined,
        aiMappingUsed: aiResult.used,
        aiMappedFields: aiResult.used
          ? Object.entries(aiResult.mapping).map(([header, field]) => ({ header, field }))
          : undefined,
        // Stored once per batch, never duplicated per record — see the
        // schema comment on ImportBatch.sourceFileBytes. Only kept for
        // OCR-derived batches, since only those have fieldBoxes pointing
        // back into it; deterministic formats have nothing for a
        // reviewer to visually compare against.
        sourceFileBytes: usedOcr ? fileBuffer : undefined,
        sourceFileMimeType: usedOcr ? (SOURCE_MIME_TYPES[fileExt] || 'application/octet-stream') : undefined,
      },
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
