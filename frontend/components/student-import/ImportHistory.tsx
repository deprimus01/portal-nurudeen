'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Clock, FileSpreadsheet, Loader2, X } from 'lucide-react';
import type { ImportBatch, ImportBatchStatus } from '../../lib/types';
import { getImportHistory } from '../../lib/studentImportApi';
import { getErrorMessage } from '../../lib/errors';
import { EmptyState } from '../ui/EmptyState';
import { ErrorState } from '../ui/ErrorState';

const EASE = [0.16, 1, 0.3, 1] as const;

const STATUS_META: Record<ImportBatchStatus, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  UPLOADED: { label: 'Uploaded', className: 'badge-gold', icon: Clock },
  PARSING: { label: 'Processing', className: 'badge-gold', icon: Loader2 },
  PREVIEW_READY: { label: 'Awaiting review', className: 'badge-warn', icon: Clock },
  COMMITTING: { label: 'Importing', className: 'badge-gold', icon: Loader2 },
  COMPLETED: { label: 'Completed', className: 'badge-success', icon: CheckCircle2 },
  FAILED: { label: 'Failed', className: 'badge-danger', icon: X },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function ImportHistory() {
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await getImportHistory();
      setBatches(data.batches);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load import history.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
        <Loader2 size={24} className="onboarding-spin" color="var(--muted-2)" />
      </div>
    );
  }

  if (error) {
    return <ErrorState kind="server" description={error} onRetry={load} />;
  }

  if (batches.length === 0) {
    return (
      <EmptyState
        icon={FileSpreadsheet}
        title="No imports yet"
        description="Once you run a Smart Student Import, every batch will show up here with its results."
        tone="blue"
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {batches.map((batch, i) => {
        const meta = STATUS_META[batch.status];
        const Icon = meta.icon;
        const uploaderName = batch.uploadedBy?.staff
          ? `${batch.uploadedBy.staff.firstName} ${batch.uploadedBy.staff.lastName}`
          : batch.uploadedBy?.email;
        return (
          <motion.div
            key={batch.id}
            className="card"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: Math.min(i * 0.03, 0.3), ease: EASE }}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(0, 85, 251, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <FileSpreadsheet size={18} color="var(--blue)" />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.92rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {batch.fileName}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--muted-2)' }}>
                  {formatDate(batch.createdAt)}{uploaderName ? ` · ${uploaderName}` : ''}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              {batch.status === 'COMPLETED' && (
                <div style={{ fontSize: '0.82rem', color: 'var(--muted-2)', display: 'flex', gap: 10 }}>
                  <span style={{ color: 'var(--success)' }}>{batch.createdCount} created</span>
                  {batch.failedCount > 0 && <span style={{ color: 'var(--danger)' }}>{batch.failedCount} failed</span>}
                </div>
              )}
              <span className={`badge ${meta.className} badge-icon`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Icon size={12} className={batch.status === 'PARSING' || batch.status === 'COMMITTING' ? 'onboarding-spin' : undefined} />
                {meta.label}
              </span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
