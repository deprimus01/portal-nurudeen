'use client';

import { useEffect, useState, FormEvent } from 'react';
import { Briefcase, CheckCircle2, KeyRound, Pencil, Search } from 'lucide-react';
import { api } from '../../../lib/api';
import type { Staff, Subject, SchoolClass } from '../../../lib/types';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { useLanguage } from '../../../lib/i18n/language-context';
import { getErrorMessage } from '../../../lib/errors';
import { DataTable, DataTableColumn } from '../../../components/ui/table/DataTable';
import type { ActionMenuItem } from '../../../components/ui/table/ActionMenu';

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [credentialsBanner, setCredentialsBanner] = useState<{ heading: string; email: string; tempPassword: string } | null>(null);
  const [search, setSearch] = useState(() => {
    if (typeof window === 'undefined') return '';
    // Deep-link support for the global search feature.
    return new URLSearchParams(window.location.search).get('q') || '';
  });

  async function load() {
    setLoading(true);
    try {
      setStaff(await api.get<Staff[]>('/api/staff'));
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load.'));
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
      if (editingId) {
        await api.patch(`/api/staff/${editingId}`, { ...form, subjectIds, classIds });
      } else {
        const result = await api.post<{ staff: Staff; tempPassword: string }>('/api/staff', {
          ...form,
          subjectIds,
          classIds,
        });
        setCredentialsBanner({ heading: 'Staff account created', email: form.email, tempPassword: result.tempPassword });
      }
      closeForm();
      await load();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save.'));
    } finally {
      setSubmitting(false);
    }
  }

  function closeForm() {
    setForm(EMPTY);
    setSubjectIds([]);
    setClassIds([]);
    setEditingId(null);
    setShowForm(false);
    setError(null);
  }

  function startEdit(s: any) {
    setForm({
      employeeId: s.employeeId || '',
      firstName: s.firstName || '',
      lastName: s.lastName || '',
      phone: s.phone || '',
      email: s.email || '',
      role: s.role || 'TEACHER',
    });
    setSubjectIds(s.staffSubjects?.map((ss: any) => ss.subject.id) || []);
    setClassIds(s.staffClasses?.map((sc: any) => sc.class.id) || []);
    setEditingId(s.id);
    setError(null);
    setShowForm(true);
  }

  async function handleForceReset(userId: string, displayName: string) {
    if (
      !confirm(
        `Reset ${displayName}'s password? Their current password will stop working immediately, and they'll need the new one-time login code to log in.`,
      )
    ) {
      return;
    }
    setError(null);
    try {
      const result = await api.post<{ email: string; tempPassword: string }>(`/api/users/${userId}/force-reset-password`, {});
      setCredentialsBanner({ heading: 'Password reset', email: result.email, tempPassword: result.tempPassword });
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to reset password.'));
    }
  }

  return (
    <div>
      <div className="topbar">
        <h1 style={{ fontSize: '1.4rem' }}>{t('pages.staff.title')}</h1>
        <button className="btn" onClick={() => (showForm ? closeForm() : setShowForm(true))}>
          {showForm ? t('common.cancel') : t('pages.staff.addButton')}
        </button>
      </div>

      {credentialsBanner && (
        <div className="card" style={{ marginBottom: '1.5rem', borderColor: 'var(--success)' }}>
          <strong style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <CheckCircle2 size={16} color="var(--success)" /> {credentialsBanner.heading} - credentials emailed automatically:
          </strong>
          <p style={{ fontSize: '0.9rem' }}>
            {credentialsBanner.email} - one-time login code: <code>{credentialsBanner.tempPassword}</code>
          </p>
          <p style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
            Shown here too in case the email doesn&apos;t land. Won&apos;t be shown again.
          </p>
          <button className="btn btn-outline" onClick={() => setCredentialsBanner(null)}>Dismiss</button>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginTop: 0, fontSize: '0.95rem' }}>{editingId ? 'Edit staff details' : 'Staff details'}</h3>
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
            {submitting ? t('common.saving') : editingId ? 'Save changes' : t('common.save')}
          </button>
        </form>
      )}

      {staff.length === 0 && error && !loading ? (
        <div className="card">
          <ErrorState description={error} onRetry={load} />
        </div>
      ) : (
        <DataTable<any>
          rows={staff}
          getRowId={(s) => s.id}
          loading={loading}
          searchValue={search}
          onSearchChange={setSearch}
          searchKeys={(s: any) => `${s.firstName} ${s.lastName} ${s.employeeId} ${s.role}`}
          searchPlaceholder="Search by name, employee ID or role…"
          emptyState={
            <EmptyState
              icon={staff.length === 0 ? Briefcase : Search}
              title={staff.length === 0 ? 'No staff yet' : 'No matching staff'}
              description={
                staff.length === 0
                  ? 'Add teachers and admins to assign them to classes and subjects.'
                  : `No staff match "${search}".`
              }
              tone="navy"
              action={
                staff.length === 0 ? (
                  <button className="btn" onClick={() => setShowForm(true)}>
                    {t('pages.staff.addButton')}
                  </button>
                ) : undefined
              }
            />
          }
          columns={[
            {
              key: 'name',
              label: t('fields.name'),
              cardRole: 'title',
              sortAccessor: (s: any) => `${s.firstName} ${s.lastName}`,
              render: (s: any) => (
                <span className="name-cell">
                  <span className="shell-avatar" style={{ width: 30, height: 30, fontSize: 11 }}>
                    {`${s.firstName?.[0] || ''}${s.lastName?.[0] || ''}`.toUpperCase()}
                  </span>
                  <span style={{ fontWeight: 600 }}>{s.firstName} {s.lastName}</span>
                </span>
              ),
            },
            {
              key: 'employeeId',
              label: t('fields.employeeId'),
              cardRole: 'subtitle',
              cardLabel: '',
              sortAccessor: (s: any) => s.employeeId,
              render: (s: any) => <span className="mono" style={{ color: 'var(--muted)' }}>{s.employeeId}</span>,
            },
            {
              key: 'role',
              label: t('fields.role'),
              sortAccessor: (s: any) => s.role,
              render: (s: any) => <span className="badge badge-gold">{s.role.replace('_', ' + ')}</span>,
            },
            {
              key: 'subjects',
              label: t('nav.subjects'),
              render: (s: any) => s.staffSubjects.map((ss: any) => ss.subject.name).join(', ') || '—',
            },
            {
              key: 'classes',
              label: t('nav.classes'),
              render: (s: any) => s.staffClasses.map((sc: any) => sc.class.name).join(', ') || '—',
            },
            {
              key: 'portal',
              label: 'Portal account',
              cardRole: 'hidden',
              render: (s: any) => <span className={`badge ${s.user ? 'badge-success' : ''}`}>{s.user ? 'Active' : 'None'}</span>,
            },
          ] as DataTableColumn<any>[]}
          actions={(s: any) => {
            const items: ActionMenuItem[] = [{ label: 'Edit staff', icon: Pencil, onClick: () => startEdit(s) }];
            if (s.user) {
              items.push({
                label: 'Force reset password',
                icon: KeyRound,
                onClick: () => handleForceReset(s.user.id, `${s.firstName} ${s.lastName}`),
              });
            }
            return items;
          }}
        />
      )}
    </div>
  );
}
