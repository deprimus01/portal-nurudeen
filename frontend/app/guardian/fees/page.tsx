'use client';

import { useEffect, useMemo, useState } from 'react';
import { FileText, TrendingUp, UserCircle, Wallet } from 'lucide-react';
import { useAuth } from '../../../lib/auth-context';
import { api } from '../../../lib/api';
import type { Invoice } from '../../../lib/types';
import { StatCard } from '../../../components/ui/StatCard';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { OfflineBanner } from '../../../components/ui/OfflineBanner';
import { getErrorMessage } from '../../../lib/errors';

function naira(kobo: number) {
  return `\u20a6${(kobo / 100).toLocaleString()}`;
}

export default function GuardianFeesPage() {
  const { user } = useAuth();
  const profile = user?.profile as any;
  const children = profile?.studentGuardians?.map((sg: any) => sg.student) || [];
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cachedAt, setCachedAt] = useState<number | undefined>();

  function load() {
    setLoading(true);
    setError(null);
    api.getWithCache<Invoice[]>('/api/fees/invoices')
      .then((res) => {
        setInvoices(res.data);
        setCachedAt(res.fromCache ? res.cachedAt : undefined);
      })
      .catch((err) => setError(getErrorMessage(err, 'Failed to load.')))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  const summary = useMemo(() => {
    let invoiced = 0;
    let paid = 0;
    for (const inv of invoices as any[]) {
      invoiced += inv.amount;
      paid += (inv.payments || []).reduce((sum: number, p: any) => sum + p.amount, 0);
    }
    return { invoiced, paid, outstanding: invoiced - paid };
  }, [invoices]);

  if (children.length === 0) {
    return (
      <div>
        <div className="topbar"><h1 className="page-title">Fees</h1></div>
        <div className="card"><EmptyState icon={UserCircle} title="No students linked" description="No students are linked to your account yet. Contact the school office to have your child linked." tone="muted" /></div>
      </div>
    );
  }

  return (
    <div>
      <div className="topbar"><h1 className="page-title">Fees</h1></div>

      {error && invoices.length > 0 && <p className="error-text">{error}</p>}
      {cachedAt !== undefined && <OfflineBanner cachedAt={cachedAt} />}

      <div className="stat-grid">
        <StatCard label="Total invoiced" value={loading ? undefined : naira(summary.invoiced)} icon={FileText} accent="navy" index={0} />
        <StatCard label="Paid" value={loading ? undefined : naira(summary.paid)} icon={TrendingUp} accent="green" index={1} />
        <StatCard label="Outstanding" value={loading ? undefined : naira(summary.outstanding)} icon={Wallet} accent="gold" index={2} />
      </div>

      <div className="table-wrap">
        {loading ? (
          <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[...Array(3)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 18, width: `${88 - i * 6}%` }} />
            ))}
          </div>
        ) : invoices.length === 0 && error ? (
          <ErrorState description={error} onRetry={load} />
        ) : invoices.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No invoices yet"
            description="Invoices will appear here once the school issues fees for your child's class."
            tone="blue"
          />
        ) : (
          <table>
            <thead><tr><th>Student</th><th>Term</th><th>Amount</th><th>Paid</th><th>Due</th><th>Status</th></tr></thead>
            <tbody>
              {invoices.map((i: any) => {
                const paid = i.payments.reduce((sum: number, p: any) => sum + p.amount, 0);
                return (
                  <tr key={i.id}>
                    <td style={{ fontWeight: 600 }}>{i.student?.firstName} {i.student?.lastName}</td>
                    <td>{i.term?.session?.name} - {i.term?.name}</td>
                    <td className="mono">{naira(i.amount)}</td>
                    <td className="mono">{naira(paid)}</td>
                    <td className="mono" style={{ color: 'var(--muted)' }}>{new Date(i.dueDate).toLocaleDateString()}</td>
                    <td>
                      <span className={`badge ${i.status === 'PAID' ? 'badge-success' : i.status === 'OVERDUE' ? 'badge-danger' : i.status === 'PARTIAL' ? 'badge-warn' : ''}`}>
                        {i.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <p style={{ color: 'var(--muted)', fontSize: '0.82rem', marginTop: '1rem' }}>
        Online payment isn&apos;t available yet - contact the school office to pay by cash or bank
        transfer, and they&apos;ll record it against your invoice.
      </p>
    </div>
  );
}
