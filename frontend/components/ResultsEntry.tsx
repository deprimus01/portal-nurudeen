'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';import { api } from '../lib/api';
import { EmptyState } from './ui/EmptyState';
import { getErrorMessage } from '../lib/errors';

interface RosterEntry {
  studentId: string;
  nameTag: string;
  firstName: string;
  lastName: string;
  score: number | null;
}

function initialsFor(first: string, last: string) {
  return `${first?.[0] || ''}${last?.[0] || ''}`.toUpperCase() || '?';
}

export function ResultsEntry({
  examOptions,
  subjectOptions,
}: {
  examOptions: { id: string; label: string }[];
  subjectOptions: { id: string; name: string }[];
}) {
  const [examId, setExamId] = useState(examOptions[0]?.id || '');
  const [subjectId, setSubjectId] = useState('');
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  async function loadRoster() {
    if (!examId || !subjectId) return;
    setLoading(true);
    setError(null);
    setSavedMessage(null);
    try {
      const data = await api.get<{ roster: RosterEntry[] }>(
        `/api/results/roster?examId=${examId}&subjectId=${subjectId}`,
      );
      setRoster(data?.roster ?? []);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load roster.'));
      setRoster([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRoster();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId, subjectId]);

  function setScore(studentId: string, value: string) {
    const num = value === '' ? null : Number(value);
    setRoster((r) => r.map((row) => (row.studentId === studentId ? { ...row, score: num } : row)));
  }

  async function handleSave() {
    const invalid = roster.filter((r) => r.score !== null && (r.score < 0 || r.score > 100));
    if (invalid.length > 0) {
      setError('Scores must be between 0 and 100.');
      return;
    }
    const toSave = roster.filter((r) => r.score !== null);
    if (toSave.length === 0) {
      setError('Enter at least one score before saving.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await api.post('/api/results', {
        examId,
        subjectId,
        records: toSave.map((r) => ({ studentId: r.studentId, score: r.score })),
      });
      setSavedMessage('Scores saved.');
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 850);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save scores.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="field" style={{ marginBottom: 0, minWidth: '220px' }}>
            <label htmlFor="resExam">Exam</label>
            <select id="resExam" value={examId} onChange={(e) => setExamId(e.target.value)}>
              {examOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0, minWidth: '180px' }}>
            <label htmlFor="resSubject">Subject</label>
            <select id="resSubject" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              <option value="" disabled>Select…</option>
              {subjectOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {error && <p className="error-text" style={{ marginBottom: '1rem' }}>{error}</p>}
      <AnimatePresence>
        {savedMessage && (
          <motion.p
            className="success-text"
            style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 6 }}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <CheckCircle2 size={15} /> {savedMessage}
          </motion.p>
        )}
      </AnimatePresence>

      {subjectId && (
        <div className="table-wrap">
          {loading ? (
            <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[...Array(5)].map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 18, width: `${88 - i * 6}%` }} />
              ))}
            </div>
          ) : roster.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="No students found" description="No active enrollments found for this exam's class/term." />
          ) : (
            <>
              <table>
                <thead><tr><th>Student</th><th>Score (0–100)</th></tr></thead>
                <tbody>
                  {roster.map((row) => (
                    <tr key={row.studentId}>
                      <td className="name-cell">
                        <div className="shell-avatar" style={{ width: 30, height: 30, fontSize: 11 }}>
                          {initialsFor(row.firstName, row.lastName)}
                        </div>
                        <span style={{ fontWeight: 600 }}>
                          {row.firstName} {row.lastName}
                          {row.nameTag && <span style={{ fontWeight: 400, color: 'var(--muted)' }}>{row.nameTag}</span>}
                        </span>
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          style={{ width: '90px' }}
                          value={row.score ?? ''}
                          onChange={(e) => setScore(row.studentId, e.target.value)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ padding: '1rem 1.25rem' }}>
                <button
                  className={`btn${justSaved ? ' btn-flash-success' : ''}`}
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <span className="login-spinner" aria-hidden="true" />
                  ) : justSaved ? (
                    <>
                      <CheckCircle2 size={15} /> Saved
                    </>
                  ) : (
                    'Save scores'
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
