'use client';

import { useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';
import { FileText } from 'lucide-react';
import { api } from '../../../lib/api';
import type { Exam, Term, SchoolClass, GradingScheme } from '../../../lib/types';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { useLanguage } from '../../../lib/i18n/language-context';
import { getErrorMessage } from '../../../lib/errors';
import { DataTable, DataTableColumn } from '../../../components/ui/table/DataTable';
import type { ActionMenuItem } from '../../../components/ui/table/ActionMenu';

const EMPTY = { name: '', termId: '', classId: '', gradingSchemeId: '' };

export default function ExamsPage() {
  const { t } = useLanguage();
  const [exams, setExams] = useState<Exam[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [schemes, setSchemes] = useState<GradingScheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [classFilter, setClassFilter] = useState('ALL');

  async function load() {
    setLoading(true);
    try {
      setExams(await api.get<Exam[]>('/api/exams'));
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    api.get<Term[]>('/api/academic/terms').then(setTerms).catch(() => {});
    api.get<SchoolClass[]>('/api/classes').then(setClasses).catch(() => {});
    api.get<GradingScheme[]>('/api/grading-schemes').then(setSchemes).catch(() => {});
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post('/api/exams', form);
      setForm(EMPTY);
      setShowForm(false);
      await load();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save.'));
    } finally {
      setSubmitting(false);
    }
  }

  const filteredExams = exams.filter((e: any) => classFilter === 'ALL' || e.class?.id === classFilter);

  return (
    <div>
      <div className="topbar">
        <h1 style={{ fontSize: '1.4rem' }}>{t('pages.exams.title')}</h1>
        <button className="btn" onClick={() => setShowForm((v) => !v)}>
          {showForm ? t('common.cancel') : t('pages.exams.addButton')}
        </button>
      </div>

      {schemes.length === 0 && !loading && (
        <p style={{ color: 'var(--muted)', fontSize: '0.88rem', marginBottom: '1rem' }}>
          You&apos;ll need a <Link href="/admin/grading-schemes">grading scheme</Link> before creating an exam.
        </p>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.8rem' }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="examName">Exam name</label>
              <input id="examName" required placeholder="e.g. First Term Examination" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="examTerm">Term</label>
              <select id="examTerm" required value={form.termId} onChange={(e) => setForm({ ...form, termId: e.target.value })}>
                <option value="" disabled>Select…</option>
                {terms.map((t: any) => <option key={t.id} value={t.id}>{t.session?.name} - {t.name}</option>)}
              </select>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="examClass">Class</label>
              <select id="examClass" required value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })}>
                <option value="" disabled>Select…</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="examScheme">Grading scheme</label>
              <select id="examScheme" required value={form.gradingSchemeId} onChange={(e) => setForm({ ...form, gradingSchemeId: e.target.value })}>
                <option value="" disabled>Select…</option>
                {schemes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          {error && <p className="error-text">{error}</p>}
          <button className="btn" type="submit" disabled={submitting} style={{ marginTop: '1rem' }}>
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </form>
      )}

      {exams.length === 0 && error && !loading ? (
        <div className="card">
          <ErrorState description={error} onRetry={load} />
        </div>
      ) : (
        <DataTable<any>
          rows={filteredExams}
          getRowId={(e) => e.id}
          loading={loading}
          searchKeys={(e: any) => `${e.name} ${e.class?.name || ''} ${e.term?.name || ''}`}
          searchPlaceholder="Search exams…"
          filters={
            <>
              <button className={`filter-chip${classFilter === 'ALL' ? ' active' : ''}`} onClick={() => setClassFilter('ALL')} type="button">
                All classes
              </button>
              {classes.slice(0, 6).map((c) => (
                <button key={c.id} className={`filter-chip${classFilter === c.id ? ' active' : ''}`} onClick={() => setClassFilter(c.id)} type="button">
                  {c.name}
                </button>
              ))}
            </>
          }
          emptyState={
            <EmptyState
              icon={FileText}
              title={exams.length === 0 ? 'No exams yet' : 'No matching exams'}
              description={
                exams.length === 0
                  ? schemes.length === 0
                    ? 'Set up a grading scheme, then create your first exam.'
                    : 'Create an exam to start recording results for a class and term.'
                  : 'Try a different class filter or search term.'
              }
              tone="gold"
              action={
                exams.length === 0 ? (
                  schemes.length > 0 ? (
                    <button className="btn" onClick={() => setShowForm(true)}>
                      {t('pages.exams.addButton')}
                    </button>
                  ) : (
                    <Link href="/admin/grading-schemes" className="btn">
                      Go to Grading Schemes
                    </Link>
                  )
                ) : undefined
              }
            />
          }
          columns={[
            { key: 'name', label: 'Exam', cardRole: 'title', sortAccessor: (e: any) => e.name, render: (e: any) => e.name },
            { key: 'class', label: 'Class', cardRole: 'subtitle', cardLabel: '', sortAccessor: (e: any) => e.class?.name || '', render: (e: any) => e.class?.name },
            { key: 'term', label: 'Term', sortAccessor: (e: any) => e.term?.name || '', render: (e: any) => `${e.term?.session?.name || ''} - ${e.term?.name || ''}` },
            { key: 'scheme', label: 'Grading scheme', render: (e: any) => e.gradingScheme?.name || '—' },
          ] as DataTableColumn<any>[]}
          actions={(e: any) => {
            const items: ActionMenuItem[] = [
              { label: 'View report cards', icon: FileText, href: `/admin/report-cards?examId=${e.id}` },
            ];
            return items;
          }}
        />
      )}
    </div>
  );
}
