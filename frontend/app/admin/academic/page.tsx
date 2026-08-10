'use client';

import { useEffect, useState, FormEvent } from 'react';
import { CalendarRange, Plus } from 'lucide-react';
import { api } from '../../../lib/api';
import type { AcademicSession, Term } from '../../../lib/types';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { useLanguage } from '../../../lib/i18n/language-context';
import { getErrorMessage } from '../../../lib/errors';

export default function AcademicPage() {
  const { t } = useLanguage();
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sessionForm, setSessionForm] = useState({ name: '', startDate: '', endDate: '', isCurrent: false });
  const [termForm, setTermForm] = useState({ name: '', sessionId: '', startDate: '', endDate: '', isCurrent: false });
  const [showSessionForm, setShowSessionForm] = useState(false);
  const [showTermForm, setShowTermForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [s, t] = await Promise.all([
        api.get<AcademicSession[]>('/api/academic/sessions'),
        api.get<Term[]>('/api/academic/terms'),
      ]);
      setSessions(s);
      setTerms(t);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleSessionSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.post('/api/academic/sessions', sessionForm);
      setSessionForm({ name: '', startDate: '', endDate: '', isCurrent: false });
      setShowSessionForm(false);
      await load();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save.'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTermSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.post('/api/academic/terms', termForm);
      setTermForm({ name: '', sessionId: '', startDate: '', endDate: '', isCurrent: false });
      setShowTermForm(false);
      await load();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="topbar">
        <h1 style={{ fontSize: '1.4rem' }}>{t('pages.academic.title')}</h1>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="topbar" style={{ marginBottom: showSessionForm ? '1rem' : 0 }}>
          <h2 style={{ fontSize: '1rem', margin: 0 }}>Academic sessions</h2>
          <button className="btn btn-outline" onClick={() => setShowSessionForm((v) => !v)}>
            {showSessionForm ? 'Cancel' : '+ Add session'}
          </button>
        </div>
        {showSessionForm && (
          <form onSubmit={handleSessionSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.6rem', marginBottom: '1rem' }}>
            <input placeholder="e.g. 2025/2026" required value={sessionForm.name} onChange={(e) => setSessionForm({ ...sessionForm, name: e.target.value })} />
            <input type="date" required value={sessionForm.startDate} onChange={(e) => setSessionForm({ ...sessionForm, startDate: e.target.value })} />
            <input type="date" required value={sessionForm.endDate} onChange={(e) => setSessionForm({ ...sessionForm, endDate: e.target.value })} />
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0 }}>
              <input type="checkbox" checked={sessionForm.isCurrent} onChange={(e) => setSessionForm({ ...sessionForm, isCurrent: e.target.checked })} />
              Current session
            </label>
            <button className="btn" type="submit" disabled={submitting}>Save</button>
            {error && sessions.length > 0 && <p className="error-text">{error}</p>}
          </form>
        )}
        {!loading && sessions.length === 0 && error ? (
          <ErrorState description={error} onRetry={load} />
        ) : !loading && sessions.length === 0 ? (
          <EmptyState
            icon={CalendarRange}
            title="No academic sessions yet"
            description="Create a session (e.g. 2025/2026) to start organizing terms and enrollments."
            tone="navy"
            action={
              <button className="btn" onClick={() => setShowSessionForm(true)}>
                <Plus size={15} /> Add Session
              </button>
            }
          />
        ) : (
        <div className="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Start</th><th>End</th><th>Status</th></tr></thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td>{new Date(s.startDate).toLocaleDateString()}</td>
                <td>{new Date(s.endDate).toLocaleDateString()}</td>
                <td>{s.isCurrent && <span className="badge badge-success">Current</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        )}
      </div>

      <div className="card">
        <div className="topbar" style={{ marginBottom: showTermForm ? '1rem' : 0 }}>
          <h2 style={{ fontSize: '1rem', margin: 0 }}>Terms</h2>
          <button className="btn btn-outline" onClick={() => setShowTermForm((v) => !v)}>
            {showTermForm ? 'Cancel' : '+ Add term'}
          </button>
        </div>
        {showTermForm && (
          <form onSubmit={handleTermSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.6rem', marginBottom: '1rem' }}>
            <select required value={termForm.sessionId} onChange={(e) => setTermForm({ ...termForm, sessionId: e.target.value })}>
              <option value="" disabled>Session…</option>
              {sessions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <input placeholder="e.g. First Term" required value={termForm.name} onChange={(e) => setTermForm({ ...termForm, name: e.target.value })} />
            <input type="date" required value={termForm.startDate} onChange={(e) => setTermForm({ ...termForm, startDate: e.target.value })} />
            <input type="date" required value={termForm.endDate} onChange={(e) => setTermForm({ ...termForm, endDate: e.target.value })} />
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0 }}>
              <input type="checkbox" checked={termForm.isCurrent} onChange={(e) => setTermForm({ ...termForm, isCurrent: e.target.checked })} />
              Current term
            </label>
            <button className="btn" type="submit" disabled={submitting}>Save</button>
            {error && terms.length > 0 && <p className="error-text">{error}</p>}
          </form>
        )}
        {!loading && terms.length === 0 && error ? (
          <ErrorState description={error} onRetry={load} />
        ) : !loading && terms.length === 0 ? (
          <EmptyState
            icon={CalendarRange}
            title="No terms yet"
            description={
              sessions.length === 0
                ? 'Create an academic session first, then add its terms here.'
                : 'Add a term (e.g. First Term) to a session to start scheduling exams and fees.'
            }
            tone="navy"
            action={
              sessions.length > 0 ? (
                <button className="btn" onClick={() => setShowTermForm(true)}>
                  <Plus size={15} /> Add Term
                </button>
              ) : undefined
            }
          />
        ) : (
        <div className="table-wrap">
        <table>
          <thead><tr><th>Term</th><th>Session</th><th>Start</th><th>End</th><th>Status</th></tr></thead>
          <tbody>
            {terms.map((t: any) => (
              <tr key={t.id}>
                <td>{t.name}</td>
                <td>{t.session?.name}</td>
                <td>{new Date(t.startDate).toLocaleDateString()}</td>
                <td>{new Date(t.endDate).toLocaleDateString()}</td>
                <td>{t.isCurrent && <span className="badge badge-success">Current</span>}</td>
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
