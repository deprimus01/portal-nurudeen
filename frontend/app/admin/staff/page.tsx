'use client';

import { useEffect, useState, FormEvent } from 'react';
import { Briefcase } from 'lucide-react';
import { api, ApiError } from '../../../lib/api';
import type { Staff, Subject, SchoolClass } from '../../../lib/types';
import { ForceResetPasswordButton } from '../../../components/ui/ForceResetPasswordButton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { useLanguage } from '../../../lib/i18n/language-context';

const ROLE_OPTIONS = ['TEACHER', 'ADMIN', 'TEACHER_ADMIN'];

const EMPTY = {
  employeeId: '', firstName: '', lastName: '', phone: '', email: '', role: 'TEACHER',
};

export default function StaffPage() {
  const { t } = useLanguage();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [subjectIds, setSubjectIds] = useState<string[]>([]);
  const [classIds, setClassIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lastCredential, setLastCredential] = useState<{ email: string; tempPassword: string } | null>(null);

  async function load() {
    setLoading(true);
    try {
      setStaff(await api.get<Staff[]>('/api/staff'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    api.get<Subject[]>('/api/subjects').then(setSubjects).catch(() => {});
    api.get<SchoolClass[]>('/api/classes').then(setClasses).catch(() => {});
  }, []);

  function toggle(list: string[], setList: (v: string[]) => void, id: string) {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await api.post<{ staff: Staff; tempPassword: string }>('/api/staff', {
        ...form,
        subjectIds,
        classIds,
      });
      setForm(EMPTY);
      setSubjectIds([]);
      setClassIds([]);
      setShowForm(false);
      setLastCredential({ email: form.email, tempPassword: result.tempPassword });
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
        <h1 style={{ fontSize: '1.4rem' }}>{t('pages.staff.title')}</h1>
        <button className="btn" onClick={() => setShowForm((v) => !v)}>
          {showForm ? t('common.cancel') : t('pages.staff.addButton')}
        </button>
      </div>

      {lastCredential && (
        <div className="card" style={{ marginBottom: '1.5rem', borderColor: 'var(--success)' }}>
          <strong>Staff account created - credentials emailed automatically:</strong>
          <p style={{ fontSize: '0.9rem' }}>
            {lastCredential.email} - temporary password: <code>{lastCredential.tempPassword}</code>
          </p>
          <p style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
            Shown here too in case the email doesn&apos;t land. Won&apos;t be shown again.
          </p>
          <button className="btn btn-outline" onClick={() => setLastCredential(null)}>Dismiss</button>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.8rem' }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="employeeId">{t('fields.employeeId')}</label>
              <input id="employeeId" required value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="firstName">{t('fields.firstName')}</label>
              <input id="firstName" required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="lastName">{t('fields.lastName')}</label>
              <input id="lastName" required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="phone">{t('fields.phone')}</label>
              <input id="phone" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="email">Email (required - used for portal login)</label>
              <input id="email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="role">{t('fields.role')}</label>
              <select id="role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r.replace('_', ' + ')}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginTop: '1rem' }}>
            <label>Subjects taught</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {subjects.map((s) => (
                <label key={s.id} className="badge" style={{ cursor: 'pointer', background: subjectIds.includes(s.id) ? 'var(--accent)' : 'var(--border)', color: subjectIds.includes(s.id) ? '#fff' : 'inherit' }}>
                  <input type="checkbox" checked={subjectIds.includes(s.id)} onChange={() => toggle(subjectIds, setSubjectIds, s.id)} style={{ display: 'none' }} />
                  {s.name}
                </label>
              ))}
            </div>
          </div>

          <div style={{ marginTop: '1rem' }}>
            <label>Classes assigned</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {classes.map((c) => (
                <label key={c.id} className="badge" style={{ cursor: 'pointer', background: classIds.includes(c.id) ? 'var(--accent)' : 'var(--border)', color: classIds.includes(c.id) ? '#fff' : 'inherit' }}>
                  <input type="checkbox" checked={classIds.includes(c.id)} onChange={() => toggle(classIds, setClassIds, c.id)} style={{ display: 'none' }} />
                  {c.name}
                </label>
              ))}
            </div>
          </div>

          {error && <p className="error-text">{error}</p>}
          <button className="btn" type="submit" disabled={submitting} style={{ marginTop: '1.2rem' }}>
            {submitting ? t('common.saving') : t('common.save')}
          </button>
        </form>
      )}

      <div className="card">
        {loading ? (
          <p style={{ color: 'var(--muted)' }}>{t('common.loading')}</p>
        ) : staff.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="No staff yet"
            description="Add teachers and admins to assign them to classes and subjects."
            tone="navy"
            action={
              <button className="btn" onClick={() => setShowForm(true)}>
                {t('pages.staff.addButton')}
              </button>
            }
          />
        ) : (
          <div className="table-wrap">
          <table>
            <thead><tr><th>{t('fields.employeeId')}</th><th>{t('fields.name')}</th><th>{t('fields.role')}</th><th>{t('nav.subjects')}</th><th>{t('nav.classes')}</th><th>Portal account</th></tr></thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id}>
                  <td>{s.employeeId}</td>
                  <td>{s.firstName} {s.lastName}</td>
                  <td>{s.role}</td>
                  <td>{s.staffSubjects.map((ss) => ss.subject.name).join(', ') || '—'}</td>
                  <td>{s.staffClasses.map((sc) => sc.class.name).join(', ') || '—'}</td>
                  <td>
                    <ForceResetPasswordButton user={s.user} displayName={`${s.firstName} ${s.lastName}`} />
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
