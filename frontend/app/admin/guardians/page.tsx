'use client';

import { useEffect, useState, FormEvent } from 'react';
import { CheckCircle2, KeyRound, MessageSquare, Pencil, Search, UserPlus, Users } from 'lucide-react';
import { api } from '../../../lib/api';
import type { Guardian } from '../../../lib/types';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { useLanguage } from '../../../lib/i18n/language-context';
import { getErrorMessage } from '../../../lib/errors';
import { DataTable, DataTableColumn } from '../../../components/ui/table/DataTable';
import type { ActionMenuItem } from '../../../components/ui/table/ActionMenu';

const EMPTY = { firstName: '', lastName: '', phone: '', email: '', address: '' };

export default function GuardiansPage() {
  const { t } = useLanguage();
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [credentialsBanner, setCredentialsBanner] = useState<{ email: string; tempPassword: string } | null>(null);
  const [search, setSearch] = useState(() => {
    if (typeof window === 'undefined') return '';
    // Deep-link support for the global search feature.
    return new URLSearchParams(window.location.search).get('q') || '';
  });

  async function load(q = '') {
    setLoading(true);
    try {
      const data = await api.get<Guardian[]>(`/api/guardians${q ? `?search=${encodeURIComponent(q)}` : ''}`);
      setGuardians(data);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const payload = { ...form, email: form.email || undefined, address: form.address || undefined };
      if (editingId) {
        await api.patch(`/api/guardians/${editingId}`, payload);
      } else {
        await api.post('/api/guardians', payload);
      }
      closeForm();
      await load(search);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save.'));
    } finally {
      setSubmitting(false);
    }
  }

  function closeForm() {
    setForm(EMPTY);
    setEditingId(null);
    setShowForm(false);
    setError(null);
  }

  function startEdit(g: any) {
    setForm({
      firstName: g.firstName || '',
      lastName: g.lastName || '',
      phone: g.phone || '',
      email: g.email || '',
      address: g.address || '',
    });
    setEditingId(g.id);
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
      setCredentialsBanner(result);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to reset password.'));
    }
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 style={{ fontSize: '1.4rem', marginBottom: '0.2rem' }}>{t('pages.guardians.title')}</h1>
          <p style={{ color: 'var(--muted)', fontSize: '0.88rem', margin: 0 }}>
            {t('pages.guardians.subtitle')}
          </p>
        </div>
        <button className="btn" onClick={() => (showForm ? closeForm() : setShowForm(true))}>
          {showForm ? t('common.cancel') : `${t('common.add')} ${t('fields.guardian')}`}
        </button>
      </div>

      {credentialsBanner && (
        <div className="card" style={{ marginBottom: '1.5rem', borderColor: 'var(--success)' }}>
          <strong style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <CheckCircle2 size={16} color="var(--success)" /> Password reset:
          </strong>
          <p style={{ fontSize: '0.9rem' }}>
            {credentialsBanner.email} - one-time login code: <code>{credentialsBanner.tempPassword}</code>
          </p>
          <p style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
            Also emailed. Won&apos;t be shown again - copy it now.
          </p>
          <button className="btn btn-outline" onClick={() => setCredentialsBanner(null)}>Dismiss</button>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginTop: 0, fontSize: '0.95rem' }}>{editingId ? 'Edit guardian details' : 'Guardian details'}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.8rem' }}>
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
              <label htmlFor="email">Email (required for portal access)</label>
              <input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="field" style={{ marginBottom: 0, gridColumn: '1 / -1' }}>
              <label htmlFor="address">{t('fields.address')}</label>
              <input id="address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
          </div>
          {error && <p className="error-text">{error}</p>}
          <button className="btn" type="submit" disabled={submitting} style={{ marginTop: '1rem' }}>
            {submitting ? t('common.saving') : editingId ? 'Save changes' : t('common.save')}
          </button>
        </form>
      )}

      {!showForm && error && guardians.length > 0 && <p className="error-text" style={{ marginBottom: '1rem' }}>{error}</p>}

      {guardians.length === 0 && error && !loading ? (
        <div className="table-wrap">
          <ErrorState description={error} onRetry={() => load(search)} />
        </div>
      ) : (
        <DataTable<any>
          rows={guardians}
          getRowId={(g) => g.id}
          loading={loading}
          searchValue={search}
          onSearchChange={(v) => { setSearch(v); load(v); }}
          searchPlaceholder={t('common.search')}
          emptyState={
            <EmptyState
              icon={search.trim() ? Search : Users}
              title={search.trim() ? 'No matching guardians' : 'No guardians yet'}
              description={
                search.trim()
                  ? `No guardians match "${search}". Try a different name, phone or email.`
                  : 'Guardians are usually added automatically when you enroll a student, or you can add one directly.'
              }
              tone="blue"
              action={
                !search.trim() ? (
                  <button className="btn" onClick={() => setShowForm(true)}>
                    <UserPlus size={15} /> {`${t('common.add')} ${t('fields.guardian')}`}
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
              sortAccessor: (g: any) => `${g.firstName} ${g.lastName}`,
              render: (g: any) => (
                <span className="name-cell">
                  <span className="shell-avatar" style={{ width: 30, height: 30, fontSize: 11 }}>
                    {`${g.firstName?.[0] || ''}${g.lastName?.[0] || ''}`.toUpperCase()}
                  </span>
                  <span style={{ fontWeight: 600 }}>{g.firstName} {g.lastName}</span>
                </span>
              ),
            },
            {
              key: 'phone',
              label: t('fields.phone'),
              cardRole: 'subtitle',
              cardLabel: '',
              sortAccessor: (g: any) => g.phone,
              className: 'mono',
            },
            { key: 'email', label: t('fields.email'), render: (g: any) => g.email || '—' },
            {
              key: 'linked',
              label: 'Linked students',
              sortAccessor: (g: any) => g.studentGuardians?.length ?? 0,
              render: (g: any) => g.studentGuardians?.length ?? 0,
            },
            {
              key: 'portal',
              label: 'Portal account',
              cardRole: 'hidden',
              render: (g: any) => <span className={`badge ${g.user ? 'badge-success' : ''}`}>{g.user ? 'Active' : 'None'}</span>,
            },
          ] as DataTableColumn<any>[]}
          actions={(g: any) => {
            const items: ActionMenuItem[] = [{ label: 'Edit guardian', icon: Pencil, onClick: () => startEdit(g) }];
            if (g.user) {
              items.push({
                label: 'Force reset password',
                icon: KeyRound,
                onClick: () => handleForceReset(g.user.id, `${g.firstName} ${g.lastName}`),
              });
            }
            items.push({ label: 'Message guardian', icon: MessageSquare, href: '/admin/messages', separatorBefore: true });
            return items;
          }}
        />
      )}
    </div>
  );
}
