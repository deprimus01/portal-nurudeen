'use client';

import { useEffect, useState, FormEvent } from 'react';
import { api, ApiError } from '../../../lib/api';
import type { GradingScheme, GradingBand } from '../../../lib/types';
import { useLanguage } from '../../../lib/i18n/language-context';

function emptyBand(): GradingBand {
  return { minScore: 0, maxScore: 0, grade: '', remark: '' };
}

export default function GradingSchemesPage() {
  const { t } = useLanguage();
  const [schemes, setSchemes] = useState<GradingScheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [bands, setBands] = useState<GradingBand[]>([emptyBand()]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setSchemes(await api.get<GradingScheme[]>('/api/grading-schemes'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function updateBand(i: number, patch: Partial<GradingBand>) {
    setBands((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  // Mirrors the server-side check in createGradingSchemeSchema — catches
  // min > max and overlapping bands before the request round-trip.
  function findBandError(rows: GradingBand[]): string | null {
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].minScore > rows[i].maxScore) {
        return `Band ${i + 1} (${rows[i].grade || '—'}): min score cannot be greater than max score.`;
      }
    }
    for (let i = 0; i < rows.length; i++) {
      for (let j = i + 1; j < rows.length; j++) {
        const a = rows[i];
        const b = rows[j];
        if (a.minScore <= b.maxScore && b.minScore <= a.maxScore) {
          return `Bands "${a.grade || i + 1}" (${a.minScore}–${a.maxScore}) and "${b.grade || j + 1}" (${b.minScore}–${b.maxScore}) overlap.`;
        }
      }
    }
    return null;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const bandError = findBandError(bands);
    if (bandError) {
      setError(bandError);
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/api/grading-schemes', { name, description: description || undefined, bands });
      setName('');
      setDescription('');
      setBands([emptyBand()]);
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
          <h1 style={{ fontSize: '1.4rem', marginBottom: '0.2rem' }}>{t('pages.gradingSchemes.title')}</h1>
          <p style={{ color: 'var(--muted)', fontSize: '0.88rem', margin: 0 }}>
            Since nursery and SSS grading differ, create one scheme per level as needed.
          </p>
        </div>
        <button className="btn" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancel' : 'Add Scheme'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', marginBottom: '1rem' }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="schemeName">Scheme name</label>
              <input id="schemeName" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Nursery Scheme" />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="schemeDesc">Description (optional)</label>
              <input id="schemeDesc" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>

          <label>Grading bands</label>
          {bands.map((b, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 2fr auto', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
              <input type="number" placeholder="Min" required value={b.minScore} onChange={(e) => updateBand(i, { minScore: Number(e.target.value) })} />
              <input type="number" placeholder="Max" required value={b.maxScore} onChange={(e) => updateBand(i, { maxScore: Number(e.target.value) })} />
              <input placeholder="Grade (e.g. A1)" required value={b.grade} onChange={(e) => updateBand(i, { grade: e.target.value })} />
              <input placeholder="Remark (e.g. Excellent)" required value={b.remark} onChange={(e) => updateBand(i, { remark: e.target.value })} />
              {bands.length > 1 && (
                <button type="button" className="btn btn-outline" onClick={() => setBands((rows) => rows.filter((_, idx) => idx !== i))}>
                  Remove
                </button>
              )}
            </div>
          ))}
          <button type="button" className="btn btn-outline" onClick={() => setBands((rows) => [...rows, emptyBand()])}>
            + Add band
          </button>

          {error && <p className="error-text">{error}</p>}
          <div style={{ marginTop: '1rem' }}>
            <button className="btn" type="submit" disabled={submitting}>{submitting ? 'Saving…' : 'Save scheme'}</button>
          </div>
        </form>
      )}

      <div className="card">
        {loading ? (
          <p style={{ color: 'var(--muted)' }}>Loading…</p>
        ) : schemes.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>No grading schemes yet.</p>
        ) : (
          schemes.map((s) => (
            <div key={s.id} style={{ marginBottom: '1.2rem' }}>
              <strong>{s.name}</strong>
              {s.description && <p style={{ color: 'var(--muted)', fontSize: '0.85rem', margin: '0.2rem 0' }}>{s.description}</p>}
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
                {s.bands.map((b) => (
                  <span key={b.id} className="badge">{b.grade} ({b.minScore}–{b.maxScore}): {b.remark}</span>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
