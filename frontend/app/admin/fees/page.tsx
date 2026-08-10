'use client';

import { useEffect, useMemo, useState, FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, CreditCard, FileText, Plus, TrendingUp, Wallet, X } from 'lucide-react';
import { api } from '../../../lib/api';
import type { FeeStructure, Invoice, SchoolClass, Term } from '../../../lib/types';
import { StatCard } from '../../../components/ui/StatCard';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { useLanguage } from '../../../lib/i18n/language-context';
import { getErrorMessage } from '../../../lib/errors';

const EASE = [0.16, 1, 0.3, 1] as const;

function naira(kobo: number) {
  return `\u20a6${(kobo / 100).toLocaleString()}`;
}

const FILTER_LABELS: Record<'ALL' | 'PAID' | 'PARTIALLY_PAID' | 'PENDING' | 'OVERDUE', string> = {
  ALL: 'All',
  PAID: 'Paid',
  PARTIALLY_PAID: 'Partial',
  PENDING: 'Unpaid',
  OVERDUE: 'Overdue',
};

export default function AdminFeesPage() {
  const { t } = useLanguage();
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showStructureForm, setShowStructureForm] = useState(false);
  const [structureForm, setStructureForm] = useState({ classId: '', termId: '', description: '', amount: '' });
  const [savingStructure, setSavingStructure] = useState(false);

  const [genForm, setGenForm] = useState({ classId: '', termId: '', dueDate: '' });
  const [generating, setGenerating] = useState(false);
  const [genMessage, setGenMessage] = useState<string | null>(null);

  const [payForm, setPayForm] = useState<{ invoiceId: string; amount: string; method: string; reference: string }>({
    invoiceId: '', amount: '', method: 'CASH', reference: '',
  });
  const [paying, setPaying] = useState(false);
  // Was 'PARTIAL' | 'UNPAID' - those never matched the real InvoiceStatus
  // enum ('PARTIALLY_PAID' | 'PENDING'), so those two filters silently
  // returned zero results. Filter state now uses the actual enum values;
  // FILTER_LABELS below keeps the friendlier button text.
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PAID' | 'PARTIALLY_PAID' | 'PENDING' | 'OVERDUE'>('ALL');

  async function loadAll() {
    setLoading(true);
    try {
      const [s, i] = await Promise.all([
        api.get<FeeStructure[]>('/api/fees/structures'),
        api.get<Invoice[]>('/api/fees/invoices'),
      ]);
      setStructures(s);
      setInvoices(i);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    api.get<SchoolClass[]>('/api/classes').then(setClasses).catch(() => {});
    api.get<Term[]>('/api/academic/terms').then(setTerms).catch(() => {});
  }, []);

  async function handleStructureSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSavingStructure(true);
    try {
      await api.post('/api/fees/structures', {
        ...structureForm,
        amount: Math.round(Number(structureForm.amount) * 100), // Naira -> kobo
      });
      setStructureForm({ classId: '', termId: '', description: '', amount: '' });
      setShowStructureForm(false);
      await loadAll();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save.'));
    } finally {
      setSavingStructure(false);
    }
  }

  async function handleGenerate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setGenMessage(null);
    setGenerating(true);
    try {
      const result = await api.post<{ created: number; message?: string }>('/api/fees/invoices/generate', genForm);
      setGenMessage(result.message || `Created ${result.created} invoice(s).`);
      await loadAll();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to generate invoices.'));
    } finally {
      setGenerating(false);
    }
  }

  async function handleRecordPayment(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPaying(true);
    try {
      await api.post('/api/fees/payments', {
        invoiceId: payForm.invoiceId,
        amount: Math.round(Number(payForm.amount) * 100),
        method: payForm.method,
        reference: payForm.reference || undefined,
      });
      setPayForm({ invoiceId: '', amount: '', method: 'CASH', reference: '' });
      await loadAll();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to record payment.'));
    } finally {
      setPaying(false);
    }
  }

  const summary = useMemo(() => {
    let invoiced = 0;
    let collected = 0;
    let overdue = 0;
    for (const inv of invoices as any[]) {
      invoiced += inv.amount;
      const paid = (inv.payments || []).reduce((sum: number, p: any) => sum + p.amount, 0);
      collected += paid;
      if (inv.status === 'OVERDUE') overdue += inv.amount - paid;
    }
    return { invoiced, collected, outstanding: invoiced - collected, overdue };
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    if (statusFilter === 'ALL') return invoices;
    return invoices.filter((i: any) => i.status === statusFilter);
  }, [invoices, statusFilter]);

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 className="page-title" style={{ marginBottom: 4 }}>{t('pages.fees.title')}</h1>
          <p className="page-sub" style={{ margin: 0 }}>Fee structures, invoices and payments.</p>
        </div>
      </div>
      {error && (structures.length > 0 || invoices.length > 0) && (
        <p className="error-text" style={{ marginBottom: '1rem' }}>{error}</p>
      )}

      {!loading && error && structures.length === 0 && invoices.length === 0 ? (
        <div className="card">
          <ErrorState description={error} onRetry={loadAll} />
        </div>
      ) : (
      <>
      <div className="stat-grid">
        <StatCard label="Total invoiced" value={loading ? undefined : naira(summary.invoiced)} icon={FileText} accent="navy" index={0} />
        <StatCard label="Collected" value={loading ? undefined : naira(summary.collected)} icon={TrendingUp} accent="green" index={1} />
        <StatCard label="Outstanding" value={loading ? undefined : naira(summary.outstanding)} icon={Wallet} accent="gold" index={2} />
        <StatCard label="Overdue" value={loading ? undefined : naira(summary.overdue)} icon={AlertCircle} accent="blue" index={3} />
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="topbar" style={{ marginBottom: showStructureForm ? '1rem' : 0 }}>
          <h2 style={{ fontSize: '1rem', margin: 0 }}>Fee structure</h2>
          <button className="btn btn-outline" onClick={() => setShowStructureForm((v) => !v)}>
            {showStructureForm ? <X size={14} /> : <Plus size={14} />}
            {showStructureForm ? 'Cancel' : 'Add line item'}
          </button>
        </div>
        <AnimatePresence initial={false}>
          {showStructureForm && (
            <motion.form
              onSubmit={handleStructureSubmit}
              style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.6rem', overflow: 'hidden' }}
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: 'auto', marginBottom: '1rem' }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              transition={{ duration: 0.28, ease: EASE }}
            >
              <select required value={structureForm.classId} onChange={(e) => setStructureForm({ ...structureForm, classId: e.target.value })}>
                <option value="" disabled>Class…</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select required value={structureForm.termId} onChange={(e) => setStructureForm({ ...structureForm, termId: e.target.value })}>
                <option value="" disabled>Term…</option>
                {terms.map((t: any) => <option key={t.id} value={t.id}>{t.session?.name} - {t.name}</option>)}
              </select>
              <input placeholder="e.g. Tuition" required value={structureForm.description} onChange={(e) => setStructureForm({ ...structureForm, description: e.target.value })} />
              <input type="number" min="1" placeholder="Amount (\u20a6)" required value={structureForm.amount} onChange={(e) => setStructureForm({ ...structureForm, amount: e.target.value })} />
              <button className="btn" type="submit" disabled={savingStructure}>
                {savingStructure ? <span className="login-spinner" aria-hidden="true" /> : 'Save'}
              </button>
            </motion.form>
          )}
        </AnimatePresence>
        {structures.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="No fee items yet"
            description="Add a line item (e.g. Tuition) for a class and term before generating invoices."
            tone="gold"
            compact
            action={
              <button className="btn" onClick={() => setShowStructureForm(true)}>
                <Plus size={15} /> Add line item
              </button>
            }
          />
        ) : (
          <div className="table-wrap">
          <table>
            <thead><tr><th>Class</th><th>Term</th><th>Item</th><th>Amount</th></tr></thead>
            <tbody>
              {structures.map((s: any) => (
                <tr key={s.id}>
                  <td>{s.class?.name}</td>
                  <td>{s.term?.session?.name} - {s.term?.name}</td>
                  <td>{s.description}</td>
                  <td className="mono">{naira(s.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      <div className="grid-2">
        <div className="card">
          <h2 style={{ fontSize: '1rem', marginTop: 0 }}>Generate invoices</h2>
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
            Creates one invoice per actively-enrolled student, summing that class/term&apos;s fee
            structure. Safe to re-run - already-invoiced students are skipped.
          </p>
          <form onSubmit={handleGenerate} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.6rem' }}>
            <select required value={genForm.classId} onChange={(e) => setGenForm({ ...genForm, classId: e.target.value })}>
              <option value="" disabled>Class…</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select required value={genForm.termId} onChange={(e) => setGenForm({ ...genForm, termId: e.target.value })}>
              <option value="" disabled>Term…</option>
              {terms.map((t: any) => <option key={t.id} value={t.id}>{t.session?.name} - {t.name}</option>)}
            </select>
            <input type="date" required value={genForm.dueDate} onChange={(e) => setGenForm({ ...genForm, dueDate: e.target.value })} />
            <button className="btn" type="submit" disabled={generating}>
              {generating ? <span className="login-spinner" aria-hidden="true" /> : 'Generate'}
            </button>
          </form>
          <AnimatePresence>
            {genMessage && (
              <motion.p
                className="success-text"
                style={{ marginTop: '0.6rem', display: 'flex', alignItems: 'center', gap: 6 }}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <CheckCircle2 size={14} /> {genMessage}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        <div className="card">
          <h2 style={{ fontSize: '1rem', marginTop: 0 }}>Record a payment</h2>
          <form onSubmit={handleRecordPayment} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.6rem' }}>
            <select required value={payForm.invoiceId} onChange={(e) => setPayForm({ ...payForm, invoiceId: e.target.value })} style={{ gridColumn: '1 / -1' }}>
              <option value="" disabled>Invoice…</option>
              {invoices.filter((i: any) => i.status !== 'PAID').map((i: any) => (
                <option key={i.id} value={i.id}>
                  {i.student?.firstName} {i.student?.lastName} - {naira(i.amount)} ({i.status})
                </option>
              ))}
            </select>
            <input type="number" min="1" placeholder="Amount (\u20a6)" required value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} />
            <select value={payForm.method} onChange={(e) => setPayForm({ ...payForm, method: e.target.value })}>
              <option value="CASH">Cash</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="PAYSTACK">Paystack</option>
              <option value="FLUTTERWAVE">Flutterwave</option>
            </select>
            <input placeholder="Reference (optional)" value={payForm.reference} onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })} />
            <button className="btn" type="submit" disabled={paying}>
              {paying ? <span className="login-spinner" aria-hidden="true" /> : <><CreditCard size={14} /> Record</>}
            </button>
          </form>
        </div>
      </div>

      <div className="table-wrap">
        <div className="table-toolbar">
          <h2 style={{ fontSize: '1rem', margin: 0, marginRight: 'auto' }}>Invoices</h2>
          {(['ALL', 'PAID', 'PARTIALLY_PAID', 'PENDING', 'OVERDUE'] as const).map((s) => (
            <button
              key={s}
              className={`filter-chip${statusFilter === s ? ' active' : ''}`}
              onClick={() => setStatusFilter(s)}
              type="button"
            >
              {FILTER_LABELS[s]}
            </button>
          ))}
        </div>
        {loading ? (
          <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 18, width: `${88 - i * 6}%` }} />
            ))}
          </div>
        ) : filteredInvoices.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={statusFilter === 'ALL' ? 'No invoices yet' : `No ${FILTER_LABELS[statusFilter].toLowerCase()} invoices`}
            description={
              statusFilter === 'ALL'
                ? 'Generate invoices for a class and term using the form below.'
                : 'Try a different status filter, or check back later.'
            }
            tone="blue"
          />
        ) : (
          <table>
            <thead><tr><th>Student</th><th>Term</th><th>Amount</th><th>Paid</th><th>Due</th><th>Status</th></tr></thead>
            <tbody>
              {filteredInvoices.map((i: any) => {
                const paid = i.payments.reduce((sum: number, p: any) => sum + p.amount, 0);
                return (
                  <tr key={i.id}>
                    <td className="name-cell">
                      <div className="shell-avatar" style={{ width: 28, height: 28, fontSize: 10 }}>
                        {`${i.student?.firstName?.[0] || ''}${i.student?.lastName?.[0] || ''}`.toUpperCase()}
                      </div>
                      {i.student?.firstName} {i.student?.lastName}
                    </td>
                    <td>{i.term?.session?.name} - {i.term?.name}</td>
                    <td className="mono">{naira(i.amount)}</td>
                    <td className="mono">{naira(paid)}</td>
                    <td className="mono" style={{ color: 'var(--muted)' }}>{new Date(i.dueDate).toLocaleDateString()}</td>
                    <td>
                      <span className={`badge ${i.status === 'PAID' ? 'badge-success' : i.status === 'OVERDUE' ? 'badge-danger' : i.status === 'PARTIALLY_PAID' ? 'badge-warn' : ''}`}>
                        {FILTER_LABELS[i.status as 'PAID' | 'PARTIALLY_PAID' | 'PENDING' | 'OVERDUE'] || i.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      </>
      )}
    </div>
  );
}
