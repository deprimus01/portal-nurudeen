'use client';

import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Download, History, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import type { ImportCommitResult } from '../../lib/types';
import { downloadFailedRowsCsv } from '../../lib/studentImportApi';

const EASE = [0.16, 1, 0.3, 1] as const;

interface SummaryStepProps {
  result: ImportCommitResult;
  historyHref: string;
  onStartNewImport: () => void;
}

export function SummaryStep({ result, historyHref, onStartNewImport }: SummaryStepProps) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: EASE }}>
      <div className="card" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
        <div
          style={{
            width: 64, height: 64, borderRadius: 16, margin: '0 auto 1rem',
            background: 'radial-gradient(circle, rgba(22, 163, 74, 0.14), transparent 70%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <CheckCircle2 size={30} color="var(--success)" strokeWidth={1.75} />
        </div>
        <h2 style={{ margin: '0 0 0.4rem' }}>Import complete</h2>
        <p style={{ color: 'var(--muted-2)', margin: 0 }}>
          {result.createdCount} student{result.createdCount === 1 ? '' : 's'} added to the portal.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginTop: '1.25rem' }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--success)' }}>{result.createdCount}</div>
          <div style={{ fontSize: '0.82rem', color: 'var(--muted-2)' }}>Created</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--gold)' }}>{result.skippedCount}</div>
          <div style={{ fontSize: '0.82rem', color: 'var(--muted-2)' }}>Skipped</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--danger)' }}>{result.failedCount}</div>
          <div style={{ fontSize: '0.82rem', color: 'var(--muted-2)' }}>Failed</div>
        </div>
      </div>

      {result.failedRows.length > 0 && (
        <div className="card" style={{ marginTop: '1.25rem' }}>
          <h3 style={{ margin: '0 0 0.6rem', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertTriangle size={16} color="var(--danger)" /> Rows that couldn&rsquo;t be imported
          </h3>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {result.failedRows.slice(0, 10).map((row) => (
              <li key={row.rowNumber} style={{ fontSize: '0.85rem', color: 'var(--muted-2)' }}>
                Row {row.rowNumber}: {row.reason}
              </li>
            ))}
          </ul>
          {result.failedRows.length > 10 && (
            <p style={{ fontSize: '0.82rem', color: 'var(--muted-2)', margin: '0.5rem 0 0' }}>
              +{result.failedRows.length - 10} more — download the full report below.
            </p>
          )}
          <button
            type="button"
            className="btn btn-outline"
            style={{ marginTop: '0.85rem' }}
            onClick={() => downloadFailedRowsCsv(result.failedRows, `import-failed-rows-${result.batch.id}.csv`)}
          >
            <Download size={15} /> Download Failed Rows
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button type="button" className="btn" onClick={onStartNewImport}>
          <RefreshCw size={15} /> Import Another File
        </button>
        <Link href={historyHref} className="btn btn-outline">
          <History size={15} /> View Import History
        </Link>
      </div>
    </motion.div>
  );
}
