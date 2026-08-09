'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { api, ApiError } from '../../../lib/api';
import { useLanguage } from '../../../lib/i18n/language-context';

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
      setEntries(data.entries);
      setFailedCount(data.failedCount);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load delivery log.');
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

      <div className="table-wrap">
        {error && <p className="error-text" style={{ padding: '1rem 1.5rem' }}>{error}</p>}
        {loading ? (
          <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 18, width: `${90 - i * 8}%` }} />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <p style={{ padding: '1.25rem 1.5rem', color: 'var(--muted)' }}>{t('common.noResults')}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>When</th><th>Recipient</th><th>Channel</th><th>Status</th><th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td style={{ fontSize: '0.82rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                    {new Date(e.sentAt).toLocaleString()}
                  </td>
                  <td style={{ fontSize: '0.85rem' }}>{e.recipientType} · <span className="mono">{e.recipientId.slice(0, 8)}…</span></td>
                  <td>{e.channel}</td>
                  <td>
                    <span className={`badge ${e.status === 'SENT' ? 'badge-success' : e.status === 'FAILED' ? 'badge-danger' : ''}`}>
                      {e.status}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.82rem', color: 'var(--muted)', maxWidth: 360 }}>
                    {e.status === 'FAILED' ? e.errorDetail || e.message : e.message}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
