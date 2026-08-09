'use client';

import { useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';
import { api, ApiError } from '../../../lib/api';
import type { Exam, Term, SchoolClass, GradingScheme } from '../../../lib/types';
import { useLanguage } from '../../../lib/i18n/language-context';

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

  async function load() {
    setLoading(true);
    try {
      setExams(await api.get<Exam[]>('/api/exams'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load.');
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
      setError(err instanceof ApiError ? err.message : 'Failed to save.');
    } finally {
      setSubmitting(false);
    }
  }

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
                {terms.map((t: any) => <option key={t.id} value={t.id}>{t.session?.name} — {t.name}</option>)}
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

      <div className="card">
        {loading ? (
          <p style={{ color: 'var(--muted)' }}>{t('common.loading')}</p>
        ) : exams.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>{t('common.noResults')}</p>
        ) : (
          <table>
            <thead><tr><th>Exam</th><th>Class</th><th>Term</th><th>Grading scheme</th><th></th></tr></thead>
            <tbody>
              {exams.map((e: any) => (
                <tr key={e.id}>
                  <td>{e.name}</td>
                  <td>{e.class?.name}</td>
                  <td>{e.term?.session?.name} — {e.term?.name}</td>
                  <td>{e.gradingScheme?.name}</td>
                  <td><Link href={`/admin/report-cards?examId=${e.id}`}>Report cards</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
