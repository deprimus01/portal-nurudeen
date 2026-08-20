'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, ChevronLeft, ChevronRight, Eye, MinusCircle, Pencil, Sparkles, Undo2,
} from 'lucide-react';
import type { ImportBatchDetail, ImportRecord, SchoolClass, Guardian } from '../../lib/types';
import { getImportBatch, correctImportRecord } from '../../lib/studentImportApi';
import { getErrorMessage } from '../../lib/errors';
import { RecordStatusBadge } from './RecordStatusBadge';
import { RecordEditor, IssueIcon } from './RecordEditor';
import { SourceVerificationModal } from './SourceVerificationModal';

const EASE = [0.16, 1, 0.3, 1] as const;
const PAGE_SIZE = 50;

// Human-readable labels for the internal field-slot names used across
// the import pipeline (fieldDictionary.js's FIELD_SLOTS) — only needed
// here for the AI-mapping disclosure banner.
const FIELD_LABELS: Record<string, string> = {
  fullName: 'Student Name',
  firstName: 'First Name',
  lastName: 'Last Name',
  otherNames: 'Other Names',
  dateOfBirth: 'Date of Birth',
  gender: 'Gender',
  className: 'Class',
  guardianFullName: 'Guardian Name',
  guardianFirstName: 'Guardian First Name',
  guardianLastName: 'Guardian Last Name',
  guardianPhone: 'Guardian Phone',
  guardianEmail: 'Guardian Email',
  guardianRelationship: 'Relationship',
};

interface PreviewStepProps {
  batchId: string;
  detail: ImportBatchDetail;
  onDetailChange: (detail: ImportBatchDetail) => void;
  classes: SchoolClass[];
  guardianOptions: Guardian[];
  onConfirm: () => void;
}

function summaryLine(counts: ImportBatchDetail['statusCounts']) {
  const ok = counts.OK || 0;
  const warning = counts.WARNING || 0;
  const error = counts.ERROR || 0;
  const skipped = counts.SKIPPED || 0;
  return { ok, warning, error, skipped, importable: ok + warning - skipped };
}

export function PreviewStep({ batchId, detail, onDetailChange, classes, guardianOptions, onConfirm }: PreviewStepProps) {
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [reviewingSourceId, setReviewingSourceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(detail.totalRecords / PAGE_SIZE));
  const counts = summaryLine(detail.statusCounts);

  async function loadPage(nextPage: number) {
    setLoading(true);
    setError(null);
    try {
      const data = await getImportBatch(batchId, nextPage, PAGE_SIZE);
      onDetailChange(data);
      setPage(nextPage);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load this page.'));
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveCorrection(record: ImportRecord, correction: Parameters<typeof correctImportRecord>[2]) {
    const { record: updated } = await correctImportRecord(batchId, record.id, correction);
    onDetailChange({
      ...detail,
      records: detail.records.map((r) => (r.id === updated.id ? updated : r)),
    });
    // Status counts may have shifted (e.g. an ERROR row is now OK) —
    // cheapest correct way to keep the summary accurate is a light
    // re-fetch of just this page's aggregate counts.
    const refreshed = await getImportBatch(batchId, page, PAGE_SIZE);
    onDetailChange(refreshed);
    setEditingId(null);
  }

  async function handleToggleSkip(record: ImportRecord) {
    const willSkip = record.status !== 'SKIPPED';
    try {
      // Un-skipping sends an empty correction (no `skip` flag) — the
      // backend treats that as "re-validate this row's current data",
      // which naturally moves it back to OK/WARNING/ERROR.
      const { record: updated } = await correctImportRecord(batchId, record.id, willSkip ? { skip: true } : {});
      const refreshed = await getImportBatch(batchId, page, PAGE_SIZE);
      onDetailChange({
        ...refreshed,
        records: refreshed.records.map((r) => (r.id === updated.id ? updated : r)),
      });
    } catch (err) {
      setError(getErrorMessage(err, 'Could not update this row.'));
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: EASE }}>
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem' }}>Before you import</h3>
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.9rem' }}>
          <span><strong style={{ color: 'var(--success)' }}>{counts.ok}</strong> ready</span>
          <span><strong style={{ color: 'var(--warn)' }}>{counts.warning}</strong> need review</span>
          <span><strong style={{ color: 'var(--danger)' }}>{counts.error}</strong> blocked by errors</span>
          <span><strong style={{ color: 'var(--gold)' }}>{counts.skipped}</strong> skipped</span>
        </div>
        <p style={{ color: 'var(--muted-2)', fontSize: '0.85rem', margin: '0.75rem 0 0' }}>
          Nothing has been saved yet. Review and correct any flagged rows below, then confirm the import when you&rsquo;re ready.
          {' '}<strong>{counts.importable}</strong> student{counts.importable === 1 ? '' : 's'} will be created.
        </p>
      </div>

      {detail.batch.aiMappingUsed && detail.batch.aiMappedFields && detail.batch.aiMappedFields.length > 0 && (
        <div
          className="card"
          style={{ marginBottom: '1.25rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start', background: 'rgba(0, 85, 251, 0.04)' }}
        >
          <Sparkles size={18} color="var(--blue)" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>Some columns were mapped with AI assistance</div>
            <p style={{ color: 'var(--muted-2)', fontSize: '0.85rem', margin: '0.3rem 0 0.5rem' }}>
              We couldn&rsquo;t automatically recognize these column headers, so an AI suggestion was used instead. Please double-check these fields carefully before confirming:
            </p>
            <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.85rem', color: 'var(--text)' }}>
              {detail.batch.aiMappedFields.map((m, i) => (
                <li key={i}>&ldquo;{m.header}&rdquo; {'\u2192'} {FIELD_LABELS[m.field] || m.field}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {error && <p style={{ color: 'var(--danger)', fontSize: '0.9rem', marginBottom: '1rem' }}>{error}</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <AnimatePresence initial={false}>
          {detail.records.map((record) => {
            const m = record.mappedData;
            const isEditing = editingId === record.id;
            const issues = record.issues || [];
            return (
              <motion.div
                key={record.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, height: 0 }}
                className="card"
                style={{ opacity: record.status === 'SKIPPED' ? 0.6 : 1 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted-2)', marginBottom: 2 }}>Row {record.rowNumber}</div>
                    <div style={{ fontWeight: 600 }}>
                      {m.firstName || m.lastName ? `${m.firstName} ${m.lastName}`.trim() : <em style={{ color: 'var(--muted-2)' }}>Unnamed</em>}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--muted-2)' }}>
                      {m.matchedClassName || m.classInput || 'No class'}
                    </div>
                  </div>
                  <RecordStatusBadge status={record.status} />
                </div>

                {issues.length > 0 && (
                  <ul style={{ listStyle: 'none', margin: '0.6rem 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {issues.map((issue, i) => (
                      <li key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: '0.82rem', color: issue.severity === 'error' ? 'var(--danger)' : 'var(--warn)' }}>
                        <IssueIcon severity={issue.severity} />
                        {issue.message}
                      </li>
                    ))}
                  </ul>
                )}

                {!isEditing && record.status !== 'SKIPPED' && (
                  <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                    <button type="button" className="btn btn-outline" onClick={() => setEditingId(record.id)}>
                      <Pencil size={14} /> {record.status === 'OK' ? 'Edit' : 'Correct'}
                    </button>
                    {record.fieldBoxes && record.fieldBoxes.length > 0 && (
                      <button type="button" className="btn btn-outline" onClick={() => setReviewingSourceId(record.id)}>
                        <Eye size={14} /> Review Source
                      </button>
                    )}
                    <button type="button" className="btn btn-outline" onClick={() => handleToggleSkip(record)}>
                      <MinusCircle size={14} /> Skip
                    </button>
                  </div>
                )}
                {!isEditing && record.status === 'SKIPPED' && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <button type="button" className="btn btn-outline" onClick={() => handleToggleSkip(record)}>
                      <Undo2 size={14} /> Include this row again
                    </button>
                  </div>
                )}

                {isEditing && (
                  <RecordEditor
                    record={record}
                    classes={classes}
                    guardianOptions={guardianOptions}
                    onSave={(correction) => handleSaveCorrection(record, correction)}
                    onCancel={() => setEditingId(null)}
                  />
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '1.25rem' }}>
          <button type="button" className="btn btn-outline" disabled={page <= 1 || loading} onClick={() => loadPage(page - 1)}>
            <ChevronLeft size={15} />
          </button>
          <span style={{ fontSize: '0.85rem', color: 'var(--muted-2)' }}>Page {page} of {totalPages}</span>
          <button type="button" className="btn btn-outline" disabled={page >= totalPages || loading} onClick={() => loadPage(page + 1)}>
            <ChevronRight size={15} />
          </button>
        </div>
      )}

      <div
        className="card"
        style={{ position: 'sticky', bottom: '1rem', marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}
      >
        <div style={{ fontSize: '0.85rem', color: 'var(--muted-2)', display: 'flex', alignItems: 'center', gap: 6 }}>
          {counts.error > 0 && <><AlertTriangle size={14} color="var(--danger)" /> {counts.error} row{counts.error === 1 ? '' : 's'} can&rsquo;t be imported until fixed.</>}
        </div>
        <button type="button" className="btn" disabled={counts.importable <= 0} onClick={onConfirm}>
          Review & Confirm Import
        </button>
      </div>

      {reviewingSourceId && (() => {
        const reviewingRecord = detail.records.find((r) => r.id === reviewingSourceId);
        if (!reviewingRecord) return null;
        return (
          <SourceVerificationModal
            batchId={batchId}
            record={reviewingRecord}
            classes={classes}
            guardianOptions={guardianOptions}
            onClose={() => setReviewingSourceId(null)}
            onSaved={(updated) => {
              onDetailChange({
                ...detail,
                records: detail.records.map((r) => (r.id === updated.id ? updated : r)),
              });
            }}
          />
        );
      })()}
    </motion.div>
  );
}
