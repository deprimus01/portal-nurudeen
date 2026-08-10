'use client';

import { useEffect, useMemo, useState } from 'react';
import { Wallet } from 'lucide-react';
import { api } from '../../lib/api';
import type { Invoice } from '../../lib/types';
import { EmptyState } from '../ui/EmptyState';
import { DashboardWidget } from '../ui/DashboardWidget';
import { Donut } from '../ui/charts/Donut';
import { getErrorMessage } from '../../lib/errors';

function naira(kobo: number) {
  return `\u20a6${Math.round(kobo / 100).toLocaleString()}`;
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Fees summary built from /api/fees/invoices - the same endpoint the
 * Fees page already uses. The backend already scopes this by role
 * (admin sees every invoice, a guardian only sees their own children's),
 * so this widget works unmodified on both the admin and guardian
 * dashboards.
 */
export function FeesWidget({ href, title = 'Fees' }: { href: string; title?: string }) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Invoice[]>('/api/fees/invoices')
      .then(setInvoices)
      .catch((err) => setError(getErrorMessage(err, 'Failed to load fees.')))
      .finally(() => setLoading(false));
  }, []);

  const summary = useMemo(() => {
    let invoiced = 0;
    let paid = 0;
    const payments: { amount: number; paidAt: string; studentName?: string }[] = [];
    for (const inv of invoices as any[]) {
      invoiced += inv.amount;
      for (const p of inv.payments || []) {
        paid += p.amount;
        payments.push({ amount: p.amount, paidAt: p.paidAt, studentName: inv.student ? `${inv.student.firstName} ${inv.student.lastName}` : undefined });
      }
    }
    payments.sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime());
    return { invoiced, paid, outstanding: Math.max(invoiced - paid, 0), payments: payments.slice(0, 5) };
  }, [invoices]);

  const pct = summary.invoiced > 0 ? Math.round((summary.paid / summary.invoiced) * 100) : 0;

  const segments = [
    { label: 'Paid', value: summary.paid, color: 'var(--success)' },
    { label: 'Outstanding', value: summary.outstanding, color: 'var(--gold)' },
  ];

  return (
    <DashboardWidget title={title} icon={Wallet} href={href} linkLabel="View fees" loading={loading} error={error}>
      {invoices.length === 0 ? (
        <EmptyState icon={Wallet} title="No invoices yet" description="Generated invoices will be summarized here." tone="muted" compact />
      ) : (
        <>
          <Donut segments={segments} centerLabel="paid" centerValue={`${pct}%`} formatValue={naira} />

          {summary.payments.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 8, fontWeight: 600 }}>
                Recent payments
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {summary.payments.map((p, i) => {
                  const d = new Date(p.paidAt);
                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                      <span style={{ color: 'var(--muted)' }}>
                        {p.studentName ? `${p.studentName} · ` : ''}
                        {MONTH_LABELS[d.getMonth()]} {d.getDate()}
                      </span>
                      <span className="mono" style={{ fontWeight: 600 }}>{naira(p.amount)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </DashboardWidget>
  );
}
