'use client';

import { useEffect, useState, FormEvent } from 'react';
import { Search, UserPlus, Users } from 'lucide-react';
import { api, ApiError } from '../../../lib/api';
import type { Guardian } from '../../../lib/types';
import { ForceResetPasswordButton } from '../../../components/ui/ForceResetPasswordButton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { useLanguage } from '../../../lib/i18n/language-context';

const EMPTY = { firstName: '', lastName: '', phone: '', email: '', address: '' };

export default function GuardiansPage() {
  const { t } = useLanguage();
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');

  async function load(q = '') {
    setLoading(true);
    try {
      const data = await api.get<Guardian[]>(`/api/guardians${q ? `?search=${encodeURIComponent(q)}` : ''}`);
      setGuardians(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post('/api/guardians', {
        ...form,
        email: form.email || undefined,
        address: form.address || undefined,
      });
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
        <div>
          <h1 style={{ fontSize: '1.4rem', marginBottom: '0.2rem' }}>{t('pages.guardians.title')}</h1>
          <p style={{ color: 'var(--muted)', fontSize: '0.88rem', margin: 0 }}>
            {t('pages.guardians.subtitle')}
          </p>
        </div>
        <button className="btn" onClick={() => setShowForm((v) => !v)}>
          {showForm ? t('common.cancel') : `${t('common.add')} ${t('fields.guardian')}`}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card" style={{ marginBottom: '1.5rem' }}>
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
            {submitting ? t('common.saving') : t('common.save')}
          </button>
        </form>
      )}

      <div className="card">
        <input
          placeholder={t('common.search')}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            load(e.target.value);
          }}
          style={{ marginBottom: '1rem' }}
        />
        {loading ? (
          <p style={{ color: 'var(--muted)' }}>{t('common.loading')}</p>
        ) : guardians.length === 0 ? (
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
        ) : (
          <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t('fields.name')}</th><th>{t('fields.phone')}</th><th>{t('fields.email')}</th><th>Linked students</th><th>Portal account</th>
              </tr>
            </thead>
            <tbody>
              {guardians.map((g: Guardian) => (
                <tr key={g.id}>
                  <td>{g.firstName} {g.lastName}</td>
                  <td>{g.phone}</td>
                  <td>{g.email || '—'}</td>
                  <td>{(g as any).studentGuardians?.length ?? 0}</td>
                  <td>
                    <ForceResetPasswordButton user={g.user} displayName={`${g.firstName} ${g.lastName}`} />
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
