'use client';

import { useState, FormEvent } from 'react';
import { Sparkles, Search } from 'lucide-react';
import { api, ApiError } from '../../../lib/api';
import type { NlReportResponse } from '../../../lib/types';
import { useLanguage } from '../../../lib/i18n/language-context';

const EXAMPLE_QUESTIONS = [
  'Which students have attendance below 80% this month?',
  'Which SSS2 students averaged below 50 on their last exam?',
  'Who has outstanding fees in JSS1?',
  'How many students are enrolled in each class?',
];

export default function AdminAiReportsPage() {
  const { t } = useLanguage();
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<NlReportResponse | null>(null);

  async function runQuestion(q: string) {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.post<NlReportResponse>('/api/ai/nl-report', { question: q.trim() });
      setResult(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to run report.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    runQuestion(question);
  }

  const rows = result?.rows || [];
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

  return (
    <div>
      <h1 className="page-title">{t('pages.aiReports.title')}</h1>
      <p className="page-sub">
        Ask a question in plain English. This only answers a fixed set of supported report types (attendance,
        exam averages, fees, enrollment counts) — it can&apos;t run arbitrary queries against the database.
      </p>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <input
            style={{ flex: 1, minWidth: 240 }}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. Which JSS2 students have attendance below 75%?"
            maxLength={300}
          />
          <button className="btn" type="submit" disabled={loading || !question.trim()}>
            {loading ? <span className="login-spinner" aria-hidden="true" /> : <Search size={15} />}
            {loading ? 'Asking…' : 'Ask'}
          </button>
        </form>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: '0.75rem' }}>
          {EXAMPLE_QUESTIONS.map((q) => (
            <button
              key={q}
              type="button"
              className="btn btn-outline"
              style={{ fontSize: '0.78rem', padding: '0.35rem 0.7rem' }}
              onClick={() => {
                setQuestion(q);
                runQuestion(q);
              }}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      {result && (
        <div className="card">
          {!result.supported || result.resolved === false ? (
            <p style={{ color: 'var(--muted)' }}>{result.message}</p>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: '1rem' }}>
                <Sparkles size={16} style={{ marginTop: 3, color: 'var(--gold)', flexShrink: 0 }} />
                <p style={{ margin: 0, fontSize: '0.95rem' }}>{result.summary}</p>
              </div>

              {rows.length > 0 && (
                <div className="table-wrap" style={{ overflowX: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        {columns.map((c) => (
                          <th key={c}>{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, i) => (
                        <tr key={i}>
                          {columns.map((c) => (
                            <td key={c}>{String(row[c])}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {result.truncated && (
                <p style={{ color: 'var(--muted)', fontSize: '0.8rem', marginTop: '0.6rem' }}>
                  Showing the first {rows.length} results — the full match set is larger.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
