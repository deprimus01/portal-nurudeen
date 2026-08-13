'use client';

import { AlertTriangle, CheckCircle2, MinusCircle, ShieldCheck, XCircle } from 'lucide-react';
import type { ImportRecordStatus } from '../../lib/types';

// Badge classes (.badge-success/.badge-warn/.badge-danger/.badge-gold)
// already exist app-wide — reused here rather than introducing new ones.
// Icon + text together (never color alone) per the accessibility
// requirement in PRD/TRD §16.
const STATUS_META: Record<ImportRecordStatus, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  OK: { label: 'Ready', className: 'badge-success', icon: CheckCircle2 },
  WARNING: { label: 'Needs review', className: 'badge-warn', icon: AlertTriangle },
  ERROR: { label: 'Error', className: 'badge-danger', icon: XCircle },
  IMPORTED: { label: 'Imported', className: 'badge-success', icon: ShieldCheck },
  SKIPPED: { label: 'Skipped', className: 'badge-gold', icon: MinusCircle },
};

export function RecordStatusBadge({ status }: { status: ImportRecordStatus }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span className={`badge ${meta.className} badge-icon`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <Icon size={12} strokeWidth={2.25} aria-hidden="true" />
      {meta.label}
    </span>
  );
}
