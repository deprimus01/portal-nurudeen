import { Router } from 'express';
import multer from 'multer';

import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateBody, asyncHandler } from '../middleware/errorHandler.js';
import { logAction } from '../lib/auditLog.js';
import { notifyNewAccount } from '../lib/notify.js';
import { assertCanActOnClass } from '../lib/classAuthorization.js';

import { assertValidImportFile } from '../lib/studentImport/fileSniff.js';
import { processImportBatch } from '../lib/studentImport/processBatch.js';
import { sourcePhaseForExt } from '../lib/studentImport/extract.js';
import { matchClass } from '../lib/studentImport/classMatcher.js';
import { validateMappedRow } from '../lib/studentImport/rowValidator.js';
import { findExactDbDuplicate, findFuzzyDbDuplicate } from '../lib/studentImport/duplicateMatcher.js';
import { commitImportRecord } from '../lib/studentImport/commitRecord.js';
import { buildImportTemplateBuffer } from '../lib/studentImport/template.js';
import { importRecordCorrectionSchema } from '../validation/studentImport.schema.js';

const router = Router();

const RETENTION_DAYS = 7;
const MAX_FILE_BYTES = 10 * 1024 * 1024; // PRD/TRD §15

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES },
});

// multer's own errors (LIMIT_FILE_SIZE, etc.) don't carry .statusCode, so
// errorHandler.js would otherwise fall through to a raw 500 — wrapped here
// to keep every failure path on the same "never leak a raw error" contract
// as the rest of the app (PRD/TRD §8).
function handleUpload(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File is too large. The limit is 10MB per import.' });
    }
    return res.status(400).json({ error: 'The uploaded file could not be processed.' });
  });
}

async function loadOwnedBatch(req, batchId) {
  const batch = await prisma.importBatch.findUnique({ where: { id: batchId } });
  if (!batch) {
    const err = new Error('Import batch not found.');
    err.statusCode = 404;
    throw err;
  }
  // Admins can act on any batch; Teachers only their own (PRD/TRD §2.1/2.2).
  if (req.user.role !== 'ADMIN' && batch.uploadedById !== req.user.id) {
    const err = new Error('You do not have permission to do that.');
    err.statusCode = 403;
    throw err;
  }
  return batch;
}

router.use(requireAuth, requireRole('ADMIN', 'TEACHER'));

// GET /api/students/import/template — downloadable canonical Excel template.
router.get(
  '/template',
  asyncHandler(async (req, res) => {
    const buffer = buildImportTemplateBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="student-import-template.xlsx"');
    res.send(buffer);
  }),
);

// GET /api/students/import/history — past batches (own for Teacher, all for Admin).
router.get(
  '/history',
  asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize, 10) || 20));

    const where = req.user.role === 'ADMIN' ? {} : { uploadedById: req.user.id };

    const [batches, total] = await Promise.all([
      prisma.importBatch.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { uploadedBy: { select: { id: true, email: true, staff: { select: { firstName: true, lastName: true } } } } },
      }),
      prisma.importBatch.count({ where }),
    ]);

    res.json({ batches, total, page, pageSize });
  }),
);

// POST /api/students/import/upload — accepts one file, stages a batch, kicks off async processing.
router.post(
  '/upload',
  handleUpload,
  asyncHandler(async (req, res) => {
    const ext = assertValidImportFile(req.file); // throws FileValidationError (statusCode 400) on failure

    const batch = await prisma.importBatch.create({
      data: {
        uploadedById: req.user.id,
        fileName: req.file.originalname.slice(0, 255),
        fileType: ext,
        sourcePhase: sourcePhaseForExt(ext),
        status: 'UPLOADED',
        expiresAt: new Date(Date.now() + RETENTION_DAYS * 24 * 60 * 60 * 1000),
      },
    });

    await logAction({
      userId: req.user.id,
      action: 'import.upload',
      entityType: 'ImportBatch',
      entityId: batch.id,
      metadata: { fileName: batch.fileName, fileType: ext },
    });

    // Detached from the request/response cycle — see processBatch.js.
    setImmediate(() => {
      processImportBatch(batch.id, req.file.buffer, ext).catch((err) => {
        console.error(`Unhandled error processing import batch ${batch.id}:`, err);
      });
    });

    res.status(202).json({ batchId: batch.id, status: batch.status });
  }),
);

// GET /api/students/import/:batchId — status + paginated preview records.
router.get(
  '/:batchId',
  asyncHandler(async (req, res) => {
    const batch = await loadOwnedBatch(req, req.params.batchId);

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 50));

    const [records, totalRecords, statusCounts] = await Promise.all([
      prisma.importRecord.findMany({
        where: { batchId: batch.id },
        orderBy: { rowNumber: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.importRecord.count({ where: { batchId: batch.id } }),
      prisma.importRecord.groupBy({ by: ['status'], where: { batchId: batch.id }, _count: true }),
    ]);

    res.json({
      batch,
      records,
      totalRecords,
      page,
      pageSize,
      statusCounts: Object.fromEntries(statusCounts.map((s) => [s.status, s._count])),
    });
  }),
);

// PATCH /api/students/import/:batchId/records/:recordId — apply a manual correction to one row.
router.patch(
  '/:batchId/records/:recordId',
  validateBody(importRecordCorrectionSchema),
  asyncHandler(async (req, res) => {
    const batch = await loadOwnedBatch(req, req.params.batchId);

    if (batch.status !== 'PREVIEW_READY') {
      const err = new Error('This batch can no longer be edited.');
      err.statusCode = 409;
      throw err;
    }

    const record = await prisma.importRecord.findUnique({ where: { id: req.params.recordId } });
    if (!record || record.batchId !== batch.id) {
      const err = new Error('Import record not found.');
      err.statusCode = 404;
      throw err;
    }

    const body = req.body;

    // Explicit skip — bypasses re-validation entirely; a SKIPPED row is
    // simply excluded from commit, not re-checked.
    if (body.skip === true) {
      const updated = await prisma.importRecord.update({
        where: { id: record.id },
        data: { status: 'SKIPPED' },
      });
      return res.json({ record: updated });
    }

    const current = record.mappedData;
    const merged = { ...current };

    if (body.firstName !== undefined) merged.firstName = body.firstName;
    if (body.lastName !== undefined) merged.lastName = body.lastName;
    if (body.otherNames !== undefined) merged.otherNames = body.otherNames;
    if (body.admissionNumber !== undefined) merged.admissionNumber = body.admissionNumber;
    if (body.dateOfBirth !== undefined) merged.dateOfBirth = body.dateOfBirth.toISOString();
    if (body.gender !== undefined) merged.gender = body.gender;
    if (body.guardianFirstName !== undefined) merged.guardianFirstName = body.guardianFirstName;
    if (body.guardianLastName !== undefined) merged.guardianLastName = body.guardianLastName;
    if (body.guardianPhone !== undefined) merged.guardianPhone = body.guardianPhone;
    if (body.guardianEmail !== undefined) merged.guardianEmail = body.guardianEmail || null;
    if (body.guardianRelationship !== undefined) merged.guardianRelationship = body.guardianRelationship;

    // Explicit class/guardian selection resolves what fuzzy matching
    // couldn't — the user picking from a real list, not free text.
    if (body.classId !== undefined) {
      const classRow = await prisma.class.findUnique({ where: { id: body.classId } });
      if (!classRow) {
        const err = new Error('Selected class was not found.');
        err.statusCode = 400;
        throw err;
      }
      merged.matchedClassId = classRow.id;
      merged.matchedClassName = classRow.name;
      merged.classInput = classRow.name;
    } else if (merged.classInput) {
      // Class text itself unchanged, but re-resolve in case earlier edits
      // (e.g. typing a class name for the first time) affect the match.
      const classes = await prisma.class.findMany();
      const { class: matchedClass } = matchClass(merged.classInput, classes);
      if (matchedClass) {
        merged.matchedClassId = matchedClass.id;
        merged.matchedClassName = matchedClass.name;
      }
    }

    if (body.guardianId !== undefined) {
      merged.matchedGuardianId = body.guardianId; // may be null, to explicitly unlink
    }

    const { status: validationStatus, issues } = validateMappedRow(merged);
    let status = validationStatus;
    const allIssues = [...issues];
    let matchedStudentId = null;

    if (merged.admissionNumber && merged.matchedClassId) {
      const exactDuplicate = await findExactDbDuplicate(prisma, merged.admissionNumber, merged.matchedClassId);
      if (exactDuplicate) {
        status = 'ERROR';
        matchedStudentId = exactDuplicate.id;
        allIssues.push({
          field: 'admissionNumber',
          severity: 'error',
          message: 'A student with this serial number already exists in this class.',
        });
      } else if (merged.dateOfBirth) {
        const fuzzyDuplicate = await findFuzzyDbDuplicate(prisma, {
          firstName: merged.firstName,
          lastName: merged.lastName,
          dateOfBirth: new Date(merged.dateOfBirth),
        });
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
    } else if (merged.admissionNumber && merged.dateOfBirth) {
      const fuzzyDuplicate = await findFuzzyDbDuplicate(prisma, {
        firstName: merged.firstName,
        lastName: merged.lastName,
        dateOfBirth: new Date(merged.dateOfBirth),
      });
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

    const updated = await prisma.importRecord.update({
      where: { id: record.id },
      data: {
        mappedData: merged,
        status,
        issues: allIssues,
        matchedStudentId,
      },
    });

    await logAction({
      userId: req.user.id,
      action: 'import.recordCorrected',
      entityType: 'ImportRecord',
      entityId: record.id,
      metadata: { batchId: batch.id, rowNumber: record.rowNumber },
    });

    res.json({ record: updated });
  }),
);

// POST /api/students/import/:batchId/commit — explicit confirmation step.
router.post(
  '/:batchId/commit',
  asyncHandler(async (req, res) => {
    const batch = await loadOwnedBatch(req, req.params.batchId);

    if (batch.status !== 'PREVIEW_READY') {
      const err = new Error('This batch is not ready to be imported.');
      err.statusCode = 409;
      throw err;
    }

    await prisma.importBatch.update({ where: { id: batch.id }, data: { status: 'COMMITTING' } });

    // Only OK/WARNING rows are attempted — ERROR rows are always blocked,
    // SKIPPED rows were explicitly excluded by the user (PRD/TRD §6.2:
    // never automatic, nothing saved without explicit confirmation).
    const importableRecords = await prisma.importRecord.findMany({
      where: { batchId: batch.id, status: { in: ['OK', 'WARNING'] } },
      orderBy: { rowNumber: 'asc' },
    });
    const skippedCount = await prisma.importRecord.count({
      where: { batchId: batch.id, status: 'SKIPPED' },
    });

    let createdCount = 0;
    let failedCount = 0;
    const allProvisionedCredentials = [];
    const failedRows = [];

    for (const record of importableRecords) {
      try {
        // Teacher class-authorization is re-checked here, per row, at
        // commit time — independent of whatever the UI allowed the user
        // to select earlier (PRD/TRD §2.2 / §20.1).
        await assertCanActOnClass(req.user, record.mappedData.matchedClassId);

        const { student, provisionedCredentials } = await commitImportRecord(prisma, record);

        await prisma.importRecord.update({
          where: { id: record.id },
          data: { status: 'IMPORTED', createdStudentId: student.id },
        });

        allProvisionedCredentials.push(...provisionedCredentials);
        createdCount += 1;
      } catch (err) {
        failedCount += 1;
        const message = err.statusCode
          ? err.message
          : err.code === 'P2002'
            ? 'A student with this serial number already exists in this class.'
            : 'This row could not be imported.';
        await prisma.importRecord.update({
          where: { id: record.id },
          data: {
            status: 'ERROR',
            issues: [...(record.issues || []), { field: null, severity: 'error', message }],
          },
        });
        failedRows.push({ rowNumber: record.rowNumber, reason: message });
        if (!err.statusCode) {
          console.error(`Import commit failed for record ${record.id}:`, err);
        }
      }
    }

    // Notifications fire after every row has been attempted, batched —
    // same fire-and-forget-safe contract as the manual creation route.
    await Promise.allSettled(
      allProvisionedCredentials.map((cred) =>
        notifyNewAccount({
          recipientType: 'guardian',
          recipientId: cred.guardianId,
          name: `${cred.firstName} ${cred.lastName}`,
          email: cred.email,
          phone: cred.phone,
          tempPassword: cred.tempPassword,
          accountType: 'guardian',
        }),
      ),
    );

    const completedBatch = await prisma.importBatch.update({
      where: { id: batch.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        createdCount,
        skippedCount,
        failedCount,
      },
    });

    await logAction({
      userId: req.user.id,
      action: 'import.commit',
      entityType: 'ImportBatch',
      entityId: batch.id,
      metadata: { createdCount, skippedCount, failedCount },
    });

    res.json({ batch: completedBatch, createdCount, skippedCount, failedCount, failedRows });
  }),
);

// DELETE /api/students/import/:batchId — cancel/discard a pre-commit batch.
router.delete(
  '/:batchId',
  asyncHandler(async (req, res) => {
    const batch = await loadOwnedBatch(req, req.params.batchId);

    if (batch.status === 'COMMITTING' || batch.status === 'COMPLETED') {
      const err = new Error('A completed import cannot be discarded.');
      err.statusCode = 409;
      throw err;
    }

    await prisma.importBatch.delete({ where: { id: batch.id } }); // cascades to ImportRecord

    await logAction({
      userId: req.user.id,
      action: 'import.cancel',
      entityType: 'ImportBatch',
      entityId: batch.id,
    });

    res.status(204).send();
  }),
);

export default router;
