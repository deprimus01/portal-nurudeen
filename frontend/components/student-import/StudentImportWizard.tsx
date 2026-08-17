'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, FileSpreadsheet, ListChecks, ShieldCheck, Upload as UploadIcon } from 'lucide-react';
import { api } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import type { ImportBatchDetail, ImportCommitResult, SchoolClass, Guardian } from '../../lib/types';
import { getImportBatch, commitImportBatch } from '../../lib/studentImportApi';
import { ErrorState } from '../ui/ErrorState';
import { UploadStep } from './UploadStep';
import { PreviewStep } from './PreviewStep';
import { ConfirmImportModal } from './ConfirmImportModal';
import { SummaryStep } from './SummaryStep';

type WizardStep = 'upload' | 'processing' | 'preview' | 'summary';

const POLL_INTERVAL_MS = 1500;

const STEP_META: { key: WizardStep; label: string; icon: typeof UploadIcon }[] = [
  { key: 'upload', label: 'Upload', icon: UploadIcon },
  { key: 'processing', label: 'Processing', icon: FileSpreadsheet },
  { key: 'preview', label: 'Review', icon: ListChecks },
  { key: 'summary', label: 'Done', icon: ShieldCheck },
];

interface StudentImportWizardProps {
  historyHref: string;
}

export function StudentImportWizard({ historyHref }: StudentImportWizardProps) {
  const [step, setStep] = useState<WizardStep>('upload');
  const [batchId, setBatchId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ImportBatchDetail | null>(null);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [guardianOptions, setGuardianOptions] = useState<Guardian[]>([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [commitResult, setCommitResult] = useState<ImportCommitResult | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    api.get<SchoolClass[]>('/api/classes').then(setClasses).catch(() => {});
    api.get<Guardian[]>('/api/guardians').then(setGuardianOptions).catch(() => {});
  }, []);

  useEffect(() => () => {
    if (pollRef.current) clearTimeout(pollRef.current);
  }, []);

  const pollBatch = useCallback((id: string) => {
    async function tick() {
      try {
        const data = await getImportBatch(id, 1, 50);
        if (data.batch.status === 'PREVIEW_READY') {
          setDetail(data);
          setStep('preview');
          return;
        }
        if (data.batch.status === 'FAILED') {
          const firstIssue = data.records[0]?.issues?.[0]?.message;
          setProcessingError(firstIssue || 'This file could not be processed. Please check its format and try again.');
          return;
        }
        // Still UPLOADED/PARSING — keep polling. A page refresh at any
        // point loses no progress: status lives server-side in
        // ImportBatch, not in this component's state (PRD/TRD §14).
        pollRef.current = setTimeout(tick, POLL_INTERVAL_MS);
      } catch (err) {
        setProcessingError(getErrorMessage(err, 'Could not check the import status.'));
      }
    }
    tick();
  }, []);

  function handleUploaded(id: string) {
    setBatchId(id);
    setProcessingError(null);
    setStep('processing');
    pollBatch(id);
  }

  function handleRetry() {
    if (batchId) {
      setProcessingError(null);
      setStep('processing');
      pollBatch(batchId);
    } else {
      setStep('upload');
    }
  }

  async function handleConfirmCommit() {
    if (!batchId) return;
    setCommitting(true);
    setCommitError(null);
    try {
      const result = await commitImportBatch(batchId);
      setCommitResult(result);
      setShowConfirmModal(false);
      setStep('summary');
    } catch (err) {
      setCommitError(getErrorMessage(err, 'Could not complete the import. Please try again.'));
    } finally {
      setCommitting(false);
    }
  }

  function handleStartNewImport() {
    setStep('upload');
    setBatchId(null);
    setDetail(null);
    setCommitResult(null);
    setProcessingError(null);
    setCommitError(null);
  }

  const currentStepIndex = STEP_META.findIndex((s) => s.key === step);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', overflowX: 'auto' }}>
        {STEP_META.map((s, i) => {
          const Icon = s.icon;
          const isDone = i < currentStepIndex;
          const isActive = i === currentStepIndex;
          return (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '0.4rem 0.8rem', borderRadius: 100,
                  background: isActive ? 'rgba(0, 85, 251, 0.1)' : isDone ? 'rgba(22, 163, 74, 0.1)' : 'var(--surface-2)',
                  color: isActive ? 'var(--blue)' : isDone ? 'var(--success)' : 'var(--muted-2)',
                  fontSize: '0.82rem', fontWeight: 600,
                }}
              >
                {isDone ? <CheckCircle2 size={14} /> : <Icon size={14} />}
                {s.label}
              </div>
              {i < STEP_META.length - 1 && <div style={{ width: 16, height: 1, background: 'var(--border)' }} />}
            </div>
          );
        })}
      </div>

      {step === 'upload' && <UploadStep onUploaded={handleUploaded} />}

      {step === 'processing' && !processingError && (
        <motion.div className="card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
          <div
            style={{
              width: 56, height: 56, borderRadius: 14, margin: '0 auto 1rem',
              background: 'radial-gradient(circle, rgba(0, 85, 251, 0.12), transparent 70%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <FileSpreadsheet size={26} color="var(--blue)" className="onboarding-spin" style={{ animationDuration: '1.6s' }} />
          </div>
          <h3 style={{ margin: '0 0 0.35rem' }}>Reading your file…</h3>
          <p style={{ margin: 0, color: 'var(--muted-2)', fontSize: '0.9rem' }} role="status" aria-live="polite">
            Matching columns, checking for duplicates, and validating each row. This usually takes a few seconds — scanned documents and photos take longer since each page is being read with OCR.
          </p>
        </motion.div>
      )}

      {step === 'processing' && processingError && (
        <ErrorState
          kind="validation"
          title="We couldn't process this file"
          description={processingError}
          onRetry={handleRetry}
        />
      )}

      {step === 'preview' && detail && (
        <PreviewStep
          batchId={batchId!}
          detail={detail}
          onDetailChange={setDetail}
          classes={classes}
          guardianOptions={guardianOptions}
          onConfirm={() => setShowConfirmModal(true)}
        />
      )}

      {showConfirmModal && detail && (
        <ConfirmImportModal
          detail={detail}
          committing={committing}
          error={commitError}
          onConfirm={handleConfirmCommit}
          onCancel={() => setShowConfirmModal(false)}
        />
      )}

      {step === 'summary' && commitResult && (
        <SummaryStep result={commitResult} historyHref={historyHref} onStartNewImport={handleStartNewImport} />
      )}
    </div>
  );
}
