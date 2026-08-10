'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Layers } from 'lucide-react';
import { api } from '../../../lib/api';
import type { SchoolClass, Subject } from '../../../lib/types';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { useLanguage } from '../../../lib/i18n/language-context';
import { getErrorMessage } from '../../../lib/errors';

export default function ClassSubjectsPage() {
  const { t } = useLanguage();
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classId, setClassId] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const [c, s] = await Promise.all([
        api.get<SchoolClass[]>('/api/classes'),
        api.get<Subject[]>('/api/subjects'),
      ]);
      setClasses(c);
      setSubjects(s);
      if (c.length > 0) setClassId(c[0].id);
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Failed to load.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!classId) return;
    const klass = classes.find((c: any) => c.id === classId) as any;
    setSelected(klass?.classSubjects?.map((cs: any) => cs.subjectId || cs.subject?.id) || []);
  }, [classId, classes]);

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSavedMessage(null);
    try {
      const updated = await api.put<SchoolClass>(`/api/classes/${classId}/subjects`, { subjectIds: selected });
      setClasses((cs) => cs.map((c) => (c.id === classId ? (updated as any) : c)));
      setSavedMessage('Saved.');
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 style={{ fontSize: '1.4rem', marginBottom: '0.2rem' }}>{t('pages.classSubjects.title')}</h1>
          <p style={{ color: 'var(--muted)', fontSize: '0.88rem', margin: 0 }}>
            Which subjects belong to each class - report cards use this to know what to expect scores for.
          </p>
        </div>
      </div>

      {loading ? (
        <p style={{ color: 'var(--muted)' }}>Loading…</p>
      ) : loadError && classes.length === 0 && subjects.length === 0 ? (
        <div className="card">
          <ErrorState description={loadError} onRetry={load} />
        </div>
      ) : classes.length === 0 || subjects.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Layers}
            title="Nothing to link yet"
            description={
              classes.length === 0
                ? 'Create at least one class and one subject before assigning subjects to classes.'
                : 'Create at least one subject before assigning it to classes.'
            }
            tone="navy"
            action={
              <Link href={classes.length === 0 ? '/admin/classes' : '/admin/subjects'} className="btn">
                <BookOpen size={15} /> Go to {classes.length === 0 ? 'Classes' : 'Subjects'}
              </Link>
            }
          />
        </div>
      ) : (
        <div className="card">
          <div className="field">
            <label htmlFor="csClass">Class</label>
            <select id="csClass" value={classId} onChange={(e) => setClassId(e.target.value)} style={{ maxWidth: '260px' }}>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', margin: '1rem 0' }}>
            {subjects.map((s) => (
              <label
                key={s.id}
                className="badge"
                style={{
                  cursor: 'pointer',
                  background: selected.includes(s.id) ? 'var(--accent)' : 'var(--border)',
                  color: selected.includes(s.id) ? '#fff' : 'inherit',
                }}
              >
                <input type="checkbox" checked={selected.includes(s.id)} onChange={() => toggle(s.id)} style={{ display: 'none' }} />
                {s.name}
              </label>
            ))}
          </div>

          {error && <p className="error-text">{error}</p>}
          {savedMessage && <p style={{ color: 'var(--success)', fontSize: '0.9rem' }}>{savedMessage}</p>}

          <button className="btn" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      )}
    </div>
  );
}
