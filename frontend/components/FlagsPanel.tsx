'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, TrendingDown } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import type { Flag, FlagsResponse, SchoolClass } from '../lib/types';
import { EmptyState } from './ui/EmptyState';
import { useLanguage } from '../lib/i18n/language-context';

// Shared by /admin/flags and /teacher/flags — the backend already scopes
// results to the caller's role (Teacher only ever sees their own assigned
// classes; Admin sees everything, or one class if filtered), so this
// component doesn't need to know which role it's rendering for.
export function FlagsPanel({ showClassFilter }: { showClassFilter: boolean }) {
  const { t } = useLanguage();
  const [flags, setFlags] = useState<Flag[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [classId, setClassId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (showClassFilter) {
      api.get<SchoolClass[]>('/api/classes').then(setClasses).catch(() => {});
    }
  }, [showClassFilter]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const qs = classId ? `?classId=${classId}` : '';
    api
      .get<FlagsResponse>(`/api/ai/flags${qs}`)
      .then((res) => {
        setFlags(res.flags);
        setNote(res.note);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load flags.'))
      .finally(() => setLoading(false));
  }, [classId]);

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 className="page-title" style={{ marginBottom: 4 }}>{t('pages.flags.title')}</h1>
          <p className="page-sub" style={{ margin: 0 }}>
            Students with a notable drop in attendance or exam performance, computed from actual records —
            not AI-generated, just the numbers.
          </p>
        </div>
        {showClassFilter && classes.length > 0 && (
          <div className="field" style={{ marginBottom: 0, minWidth: 200 }}>
            <select value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">All classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {error && <p className="error-text">{error}</p>}
      {note && <p style={{ color: 'var(--muted)', fontSize: '0.88rem' }}>{note}</p>}

      <div className="card">
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[...Array(3)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 52, borderRadius: 10 }} />
            ))}
          </div>
        ) : flags.length === 0 ? (
          <EmptyState
            icon={TrendingDown}
            title="No flags right now"
            description="No students currently show a significant attendance or performance decline."
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {flags.map((f, i) => (
              <div
                key={`${f.studentId}-${f.type}-${i}`}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: '0.7rem 0.85rem',
                  borderRadius: 10,
                  border: '1px solid var(--glass-border, rgba(0,0,0,0.08))',
                }}
              >
                <AlertTriangle size={16} style={{ marginTop: 2, color: f.severity === 'HIGH' ? 'var(--danger)' : 'var(--warn)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: '0.9rem' }}>{f.studentName}</strong>
                    <span className="badge">{f.className}</span>
                    <span className={`badge ${f.severity === 'HIGH' ? 'badge-danger' : 'badge-warn'}`}>
                      {f.severity === 'HIGH' ? 'High' : 'Medium'}
                    </span>
                    <span className="badge">{f.type === 'ATTENDANCE_DECLINE' ? 'Attendance' : 'Performance'}</span>
                  </div>
                  <p style={{ margin: '0.3rem 0 0', fontSize: '0.85rem', color: 'var(--muted)' }}>{f.detail}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
