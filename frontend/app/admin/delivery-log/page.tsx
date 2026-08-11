'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, Send } from 'lucide-react';
import { api } from '../../../lib/api';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { useLanguage } from '../../../lib/i18n/language-context';
import { getErrorMessage } from '../../../lib/errors';
import { DataTable, DataTableColumn } from '../../../components/ui/table/DataTable';

interface LogEntry {
  id: string;
  recipientType: string;
  recipientId: string;
  channel: string;
  message: string;
  status: 'SENT' | 'FAILED' | 'PENDING';
  errorDetail?: string | null;
  sentAt: string;
}

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'SENT', label: 'Sent' },
];

// Surfaces NotificationLog (see backend lib/notify.js) - every credential,
// announcement, and message notification is logged here for both channels
// (email via Resend, SMS via Termii) whether it succeeded or not. A
// failure here (e.g. Resend rejecting sends because EMAIL_FROM is still
// the onboarding@resend.dev sandbox address, or Termii rejecting an
// unapproved TERMII_SENDER_ID) previously meant the request that
// triggered it still looked successful everywhere else in the UI.
export default function DeliveryLogPage() {
  const { t } = useLanguage();
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [failedCount, setFailedCount] = useState(0);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(status = filter) {
    setLoading(true);
    setError(null);
    try {
      const qs = status ? `?status=${status}` : '';
      const data = await api.get<{ entries: LogEntry[]; failedCount: number }>(`/api/notifications/log${qs}`);
      // Explicit Array.isArray check, not `data?.entries ?? []`: arrays
      // inherit a built-in `.entries` iterator method from
      // Array.prototype, so if the response is ever a bare array instead
      // of `{ entries: [...] }`, `data.entries` resolves to that native
      // method (truthy, so `??` never falls back) instead of undefined.
      // React then treats the function handed to setEntries as a state
      // updater and calls it, which throws exactly the crash this fix is
      // meant to prevent.
      setEntries(Array.isArray(data?.entries) ? data.entries : []);
      setFailedCount(typeof data?.failedCount === 'number' ? data.failedCount : 0);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load delivery log.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 className="page-title" style={{ marginBottom: 4 }}>{t('pages.deliveryLog.title')}</h1>
          <p className="page-sub" style={{ margin: 0 }}>
            Every outbound email and SMS - credentials, announcements, messages - and whether it actually sent.
          </p>
        </div>
        <button className="btn btn-outline" onClick={() => load()} disabled={loading}>
          <RefreshCw size={14} />
          {t('common.refresh')}
        </button>
      </div>

      {failedCount > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem', borderColor: 'var(--danger)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <AlertTriangle size={18} style={{ color: 'var(--danger)', flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong>{failedCount} failed {failedCount === 1 ? 'delivery' : 'deliveries'} on record.</strong>
              <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: '0.3rem 0 0' }}>
                If every recent email fails with a sender/domain error, your Resend sender is likely
                still the sandbox address (<code>onboarding@resend.dev</code>), which can only
                deliver to your own Resend account email. Verify your school&apos;s domain in Resend
                and set <code>EMAIL_FROM</code> to an address on it. If every recent SMS fails
                instead, check that <code>TERMII_SENDER_ID</code> is an approved Sender ID on your
                Termii account - unapproved IDs fail silently on some routes.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="table-toolbar" style={{ marginBottom: '1rem' }}>
        {FILTERS.map((f) => (
          <button
            key={f.value}
            className={`filter-chip ${filter === f.value ? 'active' : ''}`}
            onClick={() => {
              setFilter(f.value);
              load(f.value);
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {entries.length === 0 && error && !loading ? (
        <div className="table-wrap">
          <ErrorState description={error} onRetry={() => load()} />
        </div>
      ) : (
        <DataTable<LogEntry>
          rows={entries}
          getRowId={(e) => e.id}
          loading={loading}
          searchKeys={(e) => `${e.recipientType} ${e.recipientId} ${e.channel} ${e.status} ${e.message}`}
          searchPlaceholder="Search deliveries…"
          emptyState={
            <EmptyState
              icon={Send}
              title={filter ? `No ${FILTERS.find((f) => f.value === filter)?.label.toLowerCase()} deliveries` : 'No deliveries yet'}
              description="Emails and SMS sent for credentials, announcements and messages will be logged here."
              tone="muted"
            />
          }
          columns={[
            {
              key: 'when',
              label: 'When',
              cardRole: 'subtitle',
              cardLabel: '',
              sortAccessor: (e) => e.sentAt,
              render: (e) => <span style={{ fontSize: '0.82rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{new Date(e.sentAt).toLocaleString()}</span>,
            },
            {
              key: 'recipient',
              label: 'Recipient',
              cardRole: 'title',
              sortAccessor: (e) => e.recipientType,
              render: (e) => <span style={{ fontSize: '0.85rem' }}>{e.recipientType} · <span className="mono">{e.recipientId.slice(0, 8)}…</span></span>,
            },
            { key: 'channel', label: 'Channel', sortAccessor: (e) => e.channel, render: (e) => e.channel },
            {
              key: 'status',
              label: 'Status',
              sortAccessor: (e) => e.status,
              render: (e) => (
                <span className={`badge ${e.status === 'SENT' ? 'badge-success' : e.status === 'FAILED' ? 'badge-danger' : ''}`}>
                  {e.status}
                </span>
              ),
            },
            {
              key: 'detail',
              label: 'Detail',
              render: (e) => (
                <span style={{ fontSize: '0.82rem', color: 'var(--muted)', maxWidth: 360, display: 'inline-block' }}>
                  {e.status === 'FAILED' ? e.errorDetail || e.message : e.message}
                </span>
              ),
            },
          ] as DataTableColumn<LogEntry>[]}
        />
      )}
    </div>
  );
}
