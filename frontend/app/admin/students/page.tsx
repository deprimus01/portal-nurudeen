'use client';

import { useEffect, useMemo, useState, FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CheckCircle2, KeyRound, MessageSquare, Pencil, Plus, Search, UploadCloud, UserMinus, UserPlus, Users, X,
} from 'lucide-react';
import Link from 'next/link';
import { api } from '../../../lib/api';
import type { Student, Guardian, SchoolClass } from '../../../lib/types';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { useLanguage } from '../../../lib/i18n/language-context';
import { getErrorMessage } from '../../../lib/errors';
import { DataTable, DataTableColumn } from '../../../components/ui/table/DataTable';
import type { ActionMenuItem } from '../../../components/ui/table/ActionMenu';

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
  const [guardianRows, setGuardianRows] = useState<GuardianRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState(() => {
    if (typeof window === 'undefined') return '';
    // Deep-link support for the global search feature.
    return new URLSearchParams(window.location.search).get('q') || '';
  });
  const [classFilter, setClassFilter] = useState('ALL');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
  const [credentialsBanner, setCredentialsBanner] = useState<{
    heading: string;
    items: { email: string; tempPassword: string }[];
  } | null>(null);

  async function loadStudents(q = '') {
    setLoading(true);
    try {
      const data = await api.get<Student[]>(`/api/students${q ? `?search=${encodeURIComponent(q)}` : ''}`);
      setStudents(data);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStudents(search);
    api.get<SchoolClass[]>('/api/classes').then(setClasses).catch(() => {});
    api.get<Guardian[]>('/api/guardians').then(setGuardianOptions).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      if (editingId) {
        await api.patch(`/api/students/${editingId}`, {
          ...studentForm,
          otherNames: studentForm.otherNames || undefined,
        });
      } else {
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
        if (result.provisionedCredentials.length > 0) {
          setCredentialsBanner({ heading: 'Portal account(s) created', items: result.provisionedCredentials });
        }
      }

      closeForm();
      await loadStudents(search);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save.'));
    } finally {
      setSubmitting(false);
    }
  }

  function closeForm() {
    setStudentForm(EMPTY_STUDENT);
    setGuardianRows([]);
    setEditingId(null);
    setShowForm(false);
    setError(null);
  }

  function startEdit(s: any) {
    setStudentForm({
      admissionNumber: s.admissionNumber || '',
      firstName: s.firstName || '',
      lastName: s.lastName || '',
      otherNames: s.otherNames || '',
      gender: s.gender || '',
      currentClassId: s.currentClass?.id || s.currentClassId || '',
    });
    setEditingId(s.id);
    setError(null);
    setShowForm(true);
  }

  async function handleProvisionAccount(studentId: string) {
    setError(null);
    try {
      const result = await api.post<{ loginEmail: string; tempPassword: string }>(
        `/api/students/${studentId}/provision-account`,
        {},
      );
      setCredentialsBanner({
        heading: 'Portal account created',
        items: [{ email: result.loginEmail, tempPassword: result.tempPassword }],
      });
      await loadStudents(search);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to provision account.'));
    }
  }

  async function handleForceReset(studentId: string, displayName: string) {
    setError(null);
    if (
      !confirm(
        `Reset ${displayName}'s password? Their current password will stop working immediately, and they'll need the new temporary password to log in.`,
      )
    ) {
      return;
    }
    try {
      const result = await api.post<{ email: string; tempPassword: string }>(
        `/api/users/${studentId}/force-reset-password`,
        {},
      );
      setCredentialsBanner({ heading: 'Password reset', items: [result] });
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to reset password.'));
    }
  }

  async function handleWithdraw(s: any) {
    if (!confirm(`Withdraw ${s.firstName} ${s.lastName}? Their records are kept, but they'll no longer show as an active student.`)) {
      return;
    }
    setWithdrawingId(s.id);
    setError(null);
    try {
      await api.delete(`/api/students/${s.id}`);
      await loadStudents(search);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to withdraw student.'));
    } finally {
      setWithdrawingId(null);
    }
  }

  async function handleBulkWithdraw(rows: any[]) {
    const active = rows.filter((s) => s.status === 'ACTIVE');
    if (active.length === 0) return;
    if (!confirm(`Withdraw ${active.length} student(s)? Their records are kept, but they'll no longer show as active.`)) {
      return;
    }
    setError(null);
    try {
      await Promise.all(active.map((s) => api.delete(`/api/students/${s.id}`)));
      await loadStudents(search);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to withdraw selected students.'));
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
        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <Link href="/admin/students/import" className="btn btn-outline">
            <UploadCloud size={15} /> Import Students
          </Link>
          <button className="btn" onClick={() => (showForm ? closeForm() : setShowForm(true))}>
            {showForm ? <X size={15} /> : <UserPlus size={15} />}
            {showForm ? t('common.cancel') : t('pages.students.addButton')}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {credentialsBanner && (
          <motion.div
            className="card"
            style={{ marginBottom: '1.5rem', borderColor: 'var(--success)', borderLeft: '3px solid var(--success)' }}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0, padding: 0 }}
          >
            <strong style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle2 size={16} color="var(--success)" /> {credentialsBanner.heading} - credentials emailed automatically where possible:
            </strong>
            <ul style={{ fontSize: '0.9rem' }}>
              {credentialsBanner.items.map((c) => (
                <li key={c.email}>{c.email} - temporary password: <code className="mono">{c.tempPassword}</code></li>
              ))}
            </ul>
            <p style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
              Shown here in case an email doesn&apos;t land (student login addresses are synthetic
              and never receive email - relay those credentials manually). SMS delivery isn&apos;t
              wired up yet, so email is the only automatic channel where a real address exists. This
              won&apos;t be shown again.
            </p>
            <button className="btn btn-outline" onClick={() => setCredentialsBanner(null)}>Dismiss</button>
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
            <h3 style={{ marginTop: 0, fontSize: '0.95rem' }}>{editingId ? 'Edit student details' : 'Student details'}</h3>
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

            {!editingId && (
              <>
                <h3 style={{ fontSize: '0.95rem', marginTop: '1.5rem' }}>Guardian(s) <span style={{ fontWeight: 400, color: 'var(--muted-2)', fontSize: '0.8rem' }}>(optional)</span></h3>
                {guardianRows.length === 0 && (
                  <p style={{ color: 'var(--muted-2)', fontSize: '0.85rem', margin: '0 0 0.7rem' }}>
                    No guardian added. You can link one later from the Guardians page.
                  </p>
                )}
              </>
            )}
            {!editingId && guardianRows.map((row, i) => (
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
                      <option key={g.id} value={g.id}>{g.firstName} {g.lastName} - {g.phone}</option>
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
                  <button type="button" className="btn btn-outline"
                    onClick={() => setGuardianRows((rows) => rows.filter((_, idx) => idx !== i))}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
            {!editingId && guardianRows.length < 4 && (
              <button type="button" className="btn btn-outline"
                onClick={() => setGuardianRows((rows) => [...rows, emptyGuardianRow(rows.length === 0)])}>
                <Plus size={14} /> Add a guardian
              </button>
            )}

            {error && <p className="error-text">{error}</p>}
            <div style={{ marginTop: '1.2rem' }}>
              <button className="btn" type="submit" disabled={submitting}>
                {submitting ? <span className="login-spinner" aria-hidden="true" /> : editingId ? 'Save changes' : 'Enroll student'}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {!showForm && error && students.length > 0 && <p className="error-text">{error}</p>}

      {students.length === 0 && error && !loading ? (
        <div className="table-wrap">
          <ErrorState description={error} onRetry={() => loadStudents(search)} />
        </div>
      ) : (
        <DataTable<any>
          rows={filteredStudents}
          getRowId={(s) => s.id}
          loading={loading}
          selectable
          bulkActions={[{ label: 'Withdraw selected', icon: UserMinus, danger: true, onClick: handleBulkWithdraw }]}
          searchValue={search}
          onSearchChange={(v) => { setSearch(v); loadStudents(v); }}
          searchPlaceholder="Search by name or serial number…"
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
            students.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No students yet"
                description="Students enrolled in this school will appear here."
                tone="blue"
                action={
                  <button className="btn" onClick={() => setShowForm(true)}>
                    <UserPlus size={15} /> Add Student
                  </button>
                }
              />
            ) : (
              <EmptyState
                icon={Search}
                title="No matching students"
                description={
                  search.trim() && classFilter !== 'ALL'
                    ? `No students match "${search}" in this class.`
                    : search.trim()
                    ? `No students match "${search}".`
                    : 'No students in this class yet.'
                }
                tone="blue"
              />
            )
          }
          columns={[
            {
              key: 'name',
              label: t('fields.student'),
              cardRole: 'title',
              sortAccessor: (s: any) => `${s.firstName} ${s.lastName}`,
              render: (s: any) => (
                <span className="name-cell">
                  <span className="shell-avatar" style={{ width: 30, height: 30, fontSize: 11 }}>
                    {initialsFor(s.firstName, s.lastName)}
                  </span>
                  <span style={{ fontWeight: 600 }}>{s.firstName} {s.lastName}</span>
                </span>
              ),
            },
            {
              key: 'admissionNumber',
              label: t('fields.admissionNumber'),
              cardRole: 'subtitle',
              cardLabel: '',
              sortAccessor: (s: any) => s.admissionNumber,
              className: 'mono',
              render: (s: any) => <span className="mono" style={{ color: 'var(--muted)' }}>{s.admissionNumber}</span>,
            },
            {
              key: 'class',
              label: t('fields.class'),
              sortAccessor: (s: any) => s.currentClass?.name || '',
              render: (s: any) => s.currentClass?.name || '—',
            },
            {
              key: 'guardians',
              label: t('nav.guardians'),
              render: (s: any) => (
                <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                  {s.studentGuardians?.map((sg: any) => `${sg.guardian.firstName} ${sg.guardian.lastName}`).join(', ') || '—'}
                </span>
              ),
            },
            {
              key: 'status',
              label: t('fields.status'),
              sortAccessor: (s: any) => s.status,
              render: (s: any) => (
                <span className={`badge ${s.status === 'ACTIVE' ? 'badge-success' : s.status === 'GRADUATED' ? 'badge-gold' : 'badge-danger'}`}>
                  {s.status}
                </span>
              ),
            },
            {
              key: 'portal',
              label: 'Portal Account',
              cardRole: 'hidden',
              render: (s: any) => (
                <span className={`badge ${s.user ? 'badge-success' : ''}`}>{s.user ? 'Active' : 'Not provisioned'}</span>
              ),
            },
          ] as DataTableColumn<any>[]}
          actions={(s: any) => {
            const items: ActionMenuItem[] = [
              { label: 'Edit student', icon: Pencil, onClick: () => startEdit(s) },
            ];
            if (s.user) {
              items.push({
                label: 'Force reset password',
                icon: KeyRound,
                onClick: () => handleForceReset(s.user.id, `${s.firstName} ${s.lastName}`),
              });
            } else {
              items.push({
                label: 'Provision portal account',
                icon: UserPlus,
                onClick: () => handleProvisionAccount(s.id),
              });
            }
            items.push({
              label: 'Message guardian',
              icon: MessageSquare,
              href: '/admin/messages',
              disabled: !s.studentGuardians?.length,
              separatorBefore: true,
            });
            items.push({
              label: withdrawingId === s.id ? 'Withdrawing…' : 'Withdraw student',
              icon: UserMinus,
              danger: true,
              disabled: s.status !== 'ACTIVE' || withdrawingId === s.id,
              onClick: () => handleWithdraw(s),
              separatorBefore: true,
            });
            return items;
          }}
        />
      )}
    </div>
  );
}
