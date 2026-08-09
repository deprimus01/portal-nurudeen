'use client';

import { useEffect, useMemo, useState, FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Plus, Search, UserPlus, Users, X } from 'lucide-react';
import { api, ApiError } from '../../../lib/api';
import type { Student, Guardian, SchoolClass } from '../../../lib/types';
import { ForceResetPasswordButton } from '../../../components/ui/ForceResetPasswordButton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { useLanguage } from '../../../lib/i18n/language-context';

const EASE = [0.16, 1, 0.3, 1] as const;
const RELATIONSHIP_OPTIONS = ['FATHER', 'MOTHER', 'GUARDIAN', 'OTHER'];

interface GuardianRow {
  mode: 'existing' | 'new';
  guardianId?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  relationship: string;
  isPrimary: boolean;
}

const EMPTY_STUDENT = {
  admissionNumber: '',
  firstName: '',
  lastName: '',
  otherNames: '',
  dateOfBirth: '',
  gender: '',
  currentClassId: '',
};

function emptyGuardianRow(isPrimary: boolean): GuardianRow {
  return { mode: 'existing', relationship: 'GUARDIAN', isPrimary };
}

function initialsFor(first: string, last: string) {
  return `${first?.[0] || ''}${last?.[0] || ''}`.toUpperCase() || '?';
}

export default function StudentsPage() {
  const { t } = useLanguage();
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [guardianOptions, setGuardianOptions] = useState<Guardian[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [studentForm, setStudentForm] = useState(EMPTY_STUDENT);
  const [guardianRows, setGuardianRows] = useState<GuardianRow[]>([emptyGuardianRow(true)]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('ALL');
  const [lastCredentials, setLastCredentials] = useState<
    { email: string; tempPassword: string }[] | null
  >(null);

  async function loadStudents(q = '') {
    setLoading(true);
    try {
      const data = await api.get<Student[]>(`/api/students${q ? `?search=${encodeURIComponent(q)}` : ''}`);
      setStudents(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStudents();
    api.get<SchoolClass[]>('/api/classes').then(setClasses).catch(() => {});
    api.get<Guardian[]>('/api/guardians').then(setGuardianOptions).catch(() => {});
  }, []);

  function updateGuardianRow(index: number, patch: Partial<GuardianRow>) {
    setGuardianRows((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!studentForm.currentClassId) {
      setError('Select a class.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await api.post<{
        student: Student;
        provisionedCredentials: { email: string; tempPassword: string }[];
      }>('/api/students', {
        ...studentForm,
        otherNames: studentForm.otherNames || undefined,
        guardians: guardianRows.map((r) =>
          r.mode === 'existing'
            ? { guardianId: r.guardianId, relationship: r.relationship, isPrimary: r.isPrimary }
            : {
                firstName: r.firstName,
                lastName: r.lastName,
                phone: r.phone,
                email: r.email || undefined,
                relationship: r.relationship,
                isPrimary: r.isPrimary,
              },
        ),
      });

      setStudentForm(EMPTY_STUDENT);
      setGuardianRows([emptyGuardianRow(true)]);
      setShowForm(false);
      if (result.provisionedCredentials.length > 0) {
        setLastCredentials(result.provisionedCredentials);
      }
      await loadStudents();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleProvisionAccount(studentId: string) {
    setError(null);
    try {
      const result = await api.post<{ loginEmail: string; tempPassword: string }>(
        `/api/students/${studentId}/provision-account`,
        {},
      );
      setLastCredentials([{ email: result.loginEmail, tempPassword: result.tempPassword }]);
      await loadStudents(search);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to provision account.');
    }
  }

  const filteredStudents = useMemo(() => {
    if (classFilter === 'ALL') return students;
    return students.filter((s: any) => s.currentClass?.id === classFilter);
  }, [students, classFilter]);

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 className="page-title" style={{ marginBottom: 4 }}>{t('pages.students.title')}</h1>
          <p className="page-sub" style={{ margin: 0 }}>
            {t('pages.students.subtitle')}
          </p>
        </div>
        <button className="btn" onClick={() => setShowForm((v) => !v)}>
          {showForm ? <X size={15} /> : <UserPlus size={15} />}
          {showForm ? t('common.cancel') : t('pages.students.addButton')}
        </button>
      </div>

      <AnimatePresence>
        {lastCredentials && (
          <motion.div
            className="card"
            style={{ marginBottom: '1.5rem', borderColor: 'var(--success)', borderLeft: '3px solid var(--success)' }}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0, padding: 0 }}
          >
            <strong style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle2 size={16} color="var(--success)" /> Portal account(s) created — credentials emailed automatically where possible:
            </strong>
            <ul style={{ fontSize: '0.9rem' }}>
              {lastCredentials.map((c) => (
                <li key={c.email}>{c.email} — temporary password: <code className="mono">{c.tempPassword}</code></li>
              ))}
            </ul>
            <p style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
              Shown here in case an email doesn&apos;t land (student login addresses are synthetic
              and never receive email — relay those credentials manually). SMS delivery isn&apos;t
              wired up yet, so email is the only automatic channel where a real address exists. This
              won&apos;t be shown again.
            </p>
            <button className="btn btn-outline" onClick={() => setLastCredentials(null)}>Dismiss</button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {showForm && (
          <motion.form
            onSubmit={handleSubmit}
            className="card"
            style={{ marginBottom: '1.5rem', overflow: 'hidden' }}
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: 'auto', marginBottom: '1.5rem' }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
          >
            <h3 style={{ marginTop: 0, fontSize: '0.95rem' }}>Student details</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.8rem' }}>
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="admissionNumber">{t('fields.admissionNumber')}</label>
                <input id="admissionNumber" required value={studentForm.admissionNumber}
                  onChange={(e) => setStudentForm({ ...studentForm, admissionNumber: e.target.value })} />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="firstName">{t('fields.firstName')}</label>
                <input id="firstName" required value={studentForm.firstName}
                  onChange={(e) => setStudentForm({ ...studentForm, firstName: e.target.value })} />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="lastName">{t('fields.lastName')}</label>
                <input id="lastName" required value={studentForm.lastName}
                  onChange={(e) => setStudentForm({ ...studentForm, lastName: e.target.value })} />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="otherNames">Other names</label>
                <input id="otherNames" value={studentForm.otherNames}
                  onChange={(e) => setStudentForm({ ...studentForm, otherNames: e.target.value })} />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="dateOfBirth">{t('fields.dateOfBirth')}</label>
                <input id="dateOfBirth" type="date" required value={studentForm.dateOfBirth}
                  onChange={(e) => setStudentForm({ ...studentForm, dateOfBirth: e.target.value })} />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="gender">{t('fields.gender')}</label>
                <select id="gender" required value={studentForm.gender}
                  onChange={(e) => setStudentForm({ ...studentForm, gender: e.target.value })}>
                  <option value="" disabled>Select…</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                </select>
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="currentClassId">{t('fields.class')}</label>
                <select id="currentClassId" required value={studentForm.currentClassId}
                  onChange={(e) => setStudentForm({ ...studentForm, currentClassId: e.target.value })}>
                  <option value="" disabled>Select…</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>

            <h3 style={{ fontSize: '0.95rem', marginTop: '1.5rem' }}>Guardian(s)</h3>
            {guardianRows.map((row, i) => (
              <div key={i} className="card" style={{ marginBottom: '0.7rem', background: 'var(--surface-2)', boxShadow: 'none' }}>
                <div style={{ display: 'flex', gap: '0.8rem', marginBottom: '0.6rem', fontSize: '0.85rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', margin: 0 }}>
                    <input type="radio" name={`mode-${i}`} checked={row.mode === 'existing'}
                      onChange={() => updateGuardianRow(i, { mode: 'existing' })} />
                    Existing guardian
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', margin: 0 }}>
                    <input type="radio" name={`mode-${i}`} checked={row.mode === 'new'}
                      onChange={() => updateGuardianRow(i, { mode: 'new' })} />
                    New guardian
                  </label>
                </div>

                {row.mode === 'existing' ? (
                  <select value={row.guardianId || ''} onChange={(e) => updateGuardianRow(i, { guardianId: e.target.value })} required>
                    <option value="" disabled>Select guardian…</option>
                    {guardianOptions.map((g) => (
                      <option key={g.id} value={g.id}>{g.firstName} {g.lastName} — {g.phone}</option>
                    ))}
                  </select>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.6rem' }}>
                    <input placeholder="First name" required value={row.firstName || ''}
                      onChange={(e) => updateGuardianRow(i, { firstName: e.target.value })} />
                    <input placeholder="Last name" required value={row.lastName || ''}
                      onChange={(e) => updateGuardianRow(i, { lastName: e.target.value })} />
                    <input placeholder="Phone" required value={row.phone || ''}
                      onChange={(e) => updateGuardianRow(i, { phone: e.target.value })} />
                    <input placeholder="Email (for portal access)" type="email" value={row.email || ''}
                      onChange={(e) => updateGuardianRow(i, { email: e.target.value })} />
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.8rem', marginTop: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <select value={row.relationship} onChange={(e) => updateGuardianRow(i, { relationship: e.target.value })} style={{ width: 'auto' }}>
                    {RELATIONSHIP_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', margin: 0, fontSize: '0.85rem' }}>
                    <input type="checkbox" checked={row.isPrimary}
                      onChange={(e) => updateGuardianRow(i, { isPrimary: e.target.checked })} />
                    Primary contact
                  </label>
                  {guardianRows.length > 1 && (
                    <button type="button" className="btn btn-outline"
                      onClick={() => setGuardianRows((rows) => rows.filter((_, idx) => idx !== i))}>
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
            {guardianRows.length < 4 && (
              <button type="button" className="btn btn-outline"
                onClick={() => setGuardianRows((rows) => [...rows, emptyGuardianRow(false)])}>
                <Plus size={14} /> Add another guardian
              </button>
            )}

            {error && <p className="error-text">{error}</p>}
            <div style={{ marginTop: '1.2rem' }}>
              <button className="btn" type="submit" disabled={submitting}>
                {submitting ? <span className="login-spinner" aria-hidden="true" /> : 'Enroll student'}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {!showForm && error && <p className="error-text">{error}</p>}

      <div className="table-wrap">
        <div className="table-toolbar">
          <div className="shell-search" style={{ maxWidth: 280, flex: 'none' }}>
            <Search size={14} />
            <input
              placeholder="Search by name or admission number…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); loadStudents(e.target.value); }}
              style={{ border: 'none', background: 'transparent', padding: 0 }}
            />
          </div>
          <button className={`filter-chip${classFilter === 'ALL' ? ' active' : ''}`} onClick={() => setClassFilter('ALL')} type="button">
            All classes
          </button>
          {classes.slice(0, 6).map((c) => (
            <button key={c.id} className={`filter-chip${classFilter === c.id ? ' active' : ''}`} onClick={() => setClassFilter(c.id)} type="button">
              {c.name}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 18, width: `${90 - i * 6}%` }} />
            ))}
          </div>
        ) : filteredStudents.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No students yet"
            description="Add your first student to start tracking attendance, results and fees."
            action={
              <button className="btn" onClick={() => setShowForm(true)}>
                <UserPlus size={15} /> Enroll Student
              </button>
            }
          />
        ) : (
          <table>
            <thead>
              <tr>
                <th>{t('fields.student')}</th><th>{t('fields.admissionNumber')}</th><th>{t('fields.class')}</th><th>{t('nav.guardians')}</th><th>{t('fields.status')}</th><th>Portal Account</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((s: any, i) => (
                <motion.tr
                  key={s.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2, delay: Math.min(i, 12) * 0.02 }}
                >
                  <td className="name-cell">
                    <div className="shell-avatar" style={{ width: 30, height: 30, fontSize: 11 }}>
                      {initialsFor(s.firstName, s.lastName)}
                    </div>
                    <span style={{ fontWeight: 600 }}>{s.firstName} {s.lastName}</span>
                  </td>
                  <td className="mono" style={{ color: 'var(--muted)' }}>{s.admissionNumber}</td>
                  <td>{s.currentClass?.name || '—'}</td>
                  <td style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                    {s.studentGuardians?.map((sg: any) => `${sg.guardian.firstName} ${sg.guardian.lastName}`).join(', ') || '—'}
                  </td>
                  <td>
                    <span className={`badge ${s.status === 'ACTIVE' ? 'badge-success' : 'badge-danger'}`}>
                      {s.status}
                    </span>
                  </td>
                  <td>
                    {s.user ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
                        <span className="badge badge-success">Active</span>
                        <ForceResetPasswordButton user={s.user} displayName={`${s.firstName} ${s.lastName}`} />
                      </div>
                    ) : (
                      <button className="btn btn-outline" onClick={() => handleProvisionAccount(s.id)}>
                        Provision
                      </button>
                    )}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
