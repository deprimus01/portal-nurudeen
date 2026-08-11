'use client';

import { useEffect, useState, FormEvent } from 'react';
import { UserPlus } from 'lucide-react';
import { api } from '../../../lib/api';
import type { Enrollment, Student, SchoolClass, Term } from '../../../lib/types';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { useLanguage } from '../../../lib/i18n/language-context';
import { getErrorMessage } from '../../../lib/errors';
import { DataTable, DataTableColumn } from '../../../components/ui/table/DataTable';

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
      setError(getErrorMessage(err, 'Failed to load.'));
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
      setError(getErrorMessage(err, 'Failed to save.'));
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

      {enrollments.length === 0 && error && !loading ? (
        <div className="card">
          <ErrorState description={error} onRetry={() => load(termFilter)} />
        </div>
      ) : (
        <DataTable<any>
          rows={enrollments}
          getRowId={(e) => e.id}
          loading={loading}
          searchKeys={(e: any) => `${e.student.firstName} ${e.student.lastName} ${e.class.name}`}
          searchPlaceholder="Search by student or class…"
          filters={
            <select
              value={termFilter}
              onChange={(e) => { setTermFilter(e.target.value); load(e.target.value); }}
              className="dt-select"
            >
              <option value="">All terms</option>
              {terms.map((t: any) => (
                <option key={t.id} value={t.id}>{t.session?.name} - {t.name}</option>
              ))}
            </select>
          }
          emptyState={
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
          }
          columns={[
            {
              key: 'student',
              label: 'Student',
              cardRole: 'title',
              sortAccessor: (e: any) => `${e.student.firstName} ${e.student.lastName}`,
              render: (e: any) => `${e.student.firstName} ${e.student.lastName}`,
            },
            { key: 'class', label: 'Class', cardRole: 'subtitle', cardLabel: '', sortAccessor: (e: any) => e.class.name, render: (e: any) => e.class.name },
            { key: 'term', label: 'Term', render: (e: any) => `${e.term.session?.name || ''} - ${e.term.name}` },
            {
              key: 'status',
              label: 'Status',
              sortAccessor: (e: any) => e.status,
              render: (e: any) => <span className={`badge ${e.status === 'ACTIVE' ? 'badge-success' : ''}`}>{e.status}</span>,
            },
          ] as DataTableColumn<any>[]}
        />
      )}
    </div>
  );
}
