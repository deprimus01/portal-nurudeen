'use client';

import { motion } from 'framer-motion';
import { AlertTriangle, Loader2, ShieldCheck, X } from 'lucide-react';
import type { ImportBatchDetail } from '../../lib/types';

interface ConfirmImportModalProps {
  detail: ImportBatchDetail;
  committing: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmImportModal({ detail, committing, error, onConfirm, onCancel }: ConfirmImportModalProps) {
  const ok = detail.statusCounts.OK || 0;
  const warning = detail.statusCounts.WARNING || 0;
  const errorCount = detail.statusCounts.ERROR || 0;
  const skipped = detail.statusCounts.SKIPPED || 0;
  const importable = ok + warning - skipped;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0, 0, 56, 0.45)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-import-title"
    >
      <motion.div
        className="card"
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        style={{ maxWidth: 440, width: '100%' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h3 id="confirm-import-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldCheck size={18} color="var(--blue)" /> Confirm Import
          </h3>
          <button type="button" className="btn-ghost" onClick={onCancel} disabled={committing} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <p style={{ color: 'var(--muted-2)', fontSize: '0.9rem' }}>
          This will create <strong style={{ color: 'var(--text)' }}>{importable} student{importable === 1 ? '' : 's'}</strong> in the portal, with guardian accounts provisioned where applicable. This can&rsquo;t be undone automatically.
        </p>

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.85rem', margin: '0.75rem 0' }}>
          <span><strong style={{ color: 'var(--success)' }}>{ok}</strong> ready</span>
          <span><strong style={{ color: 'var(--warn)' }}>{warning}</strong> flagged (will still import)</span>
          <span><strong style={{ color: 'var(--gold)' }}>{skipped}</strong> skipped (excluded)</span>
          <span><strong style={{ color: 'var(--danger)' }}>{errorCount}</strong> blocked (excluded)</span>
        </div>

        {error && (
          <p style={{ color: 'var(--danger)', fontSize: '0.85rem', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
            <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2 }} /> {error}
          </p>
        )}

        <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1.25rem', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-outline" onClick={onCancel} disabled={committing}>
            Go Back
          </button>
          <button type="button" className="btn" onClick={onConfirm} disabled={committing || importable <= 0}>
            {committing ? <Loader2 size={15} className="onboarding-spin" /> : <ShieldCheck size={15} />}
            {committing ? 'Importing…' : `Import ${importable} Student${importable === 1 ? '' : 's'}`}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
