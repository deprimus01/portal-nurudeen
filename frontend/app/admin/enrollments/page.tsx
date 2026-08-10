'use client';

import { useEffect, useState, FormEvent } from 'react';
import { UserPlus } from 'lucide-react';
import { api, ApiError } from '../../../lib/api';
import type { Enrollment, Student, SchoolClass, Term } from '../../../lib/types';
import { EmptyState } from '../../../components/ui/EmptyState';
import { useLanguage } from '../../../lib/i18n/language-context';

const EMPTY = { studentId: '', classId: '', termId: '' };

export default function EnrollmentsPage() {
  const { t } = useLanguage();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [termFilter, setTermFilter] = useState('');

  async function load(filterTermId = '') {
    setLoading(true);
    try {
      const data = await api.get<Enrollment[]>(
        `/api/enrollments${filterTermId ? `?termId=${filterTermId}` : ''}`,
      );
      setEnrollments(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    api.get<Student[]>('/api/students').then(setStudents).catch(() => {});
    api.get<SchoolClass[]>('/api/classes').then(setClasses).catch(() => {});
    api.get<Term[]>('/api/academic/terms').then(setTerms).catch(() => {});
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post('/api/enrollments', form);
      setForm(EMPTY);
      setShowForm(false);
      await load(termFilter);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 style={{ fontSize: '1.4rem', marginBottom: '0.2rem' }}>{t('pages.enrollments.title')}</h1>
          <p style={{ color: 'var(--muted)', fontSize: '0.88rem', margin: 0 }}>
            Links a student to a class for a specific term. This is also how yearly promotion
            works - enroll a student in a new term/class, and their &ldquo;current class&rdquo;
            moves with it.
          </p>
        </div>
        <button className="btn" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancel' : 'Add Enrollment'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.8rem' }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="studentId">Student</label>
              <select id="studentId" required value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })}>
                <option value="" disabled>Select…</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.admissionNumber})</option>
                ))}
              </select>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="classId">Class</label>
              <select id="classId" required value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })}>
                <option value="" disabled>Select…</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="termId">Term</label>
              <select id="termId" required value={form.termId} onChange={(e) => setForm({ ...form, termId: e.target.value })}>
                <option value="" disabled>Select…</option>
                {terms.map((t: any) => (
                  <option key={t.id} value={t.id}>{t.session?.name} - {t.name}</option>
                ))}
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
        <select
          value={termFilter}
          onChange={(e) => { setTermFilter(e.target.value); load(e.target.value); }}
          style={{ marginBottom: '1rem', maxWidth: '280px' }}
        >
          <option value="">All terms</option>
          {terms.map((t: any) => (
            <option key={t.id} value={t.id}>{t.session?.name} - {t.name}</option>
          ))}
        </select>

        {loading ? (
          <p style={{ color: 'var(--muted)' }}>Loading…</p>
        ) : enrollments.length === 0 ? (
          <EmptyState
            icon={UserPlus}
            title="No enrollments yet"
            description="Enroll students into classes to begin tracking their academic activity."
            tone="blue"
            action={
              <button className="btn" onClick={() => setShowForm(true)}>
                <UserPlus size={15} /> Create Enrollment
              </button>
            }
          />
        ) : (
          <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Student</th><th>Class</th><th>Term</th><th>Status</th></tr>
            </thead>
            <tbody>
              {enrollments.map((e: any) => (
                <tr key={e.id}>
                  <td>{e.student.firstName} {e.student.lastName}</td>
                  <td>{e.class.name}</td>
                  <td>{e.term.session?.name} - {e.term.name}</td>
                  <td>
                    <span className={`badge ${e.status === 'ACTIVE' ? 'badge-success' : ''}`}>{e.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}
