'use client';

import { useState, FormEvent } from 'react';
import { MessageCircleQuestion, Sparkles, UserCircle } from 'lucide-react';
import { useAuth } from '../../../lib/auth-context';
import { api, ApiError } from '../../../lib/api';
import { EmptyState } from '../../../components/ui/EmptyState';

interface QaEntry {
  question: string;
  answer: string;
}

export default function GuardianAskPage() {
  const { user } = useAuth();
  const profile = user?.profile as any;
  const children = profile?.studentGuardians?.map((sg: any) => sg.student) || [];
  const [studentId, setStudentId] = useState(children[0]?.id || '');
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState<QaEntry[]>([]);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAsk(e: FormEvent) {
    e.preventDefault();
    if (!question.trim() || !studentId) return;
    setAsking(true);
    setError(null);
    const askedQuestion = question;
    try {
      const result = await api.post<{ answer: string }>('/api/ai/parent-qa', {
        studentId,
        question: askedQuestion,
      });
      setHistory((h) => [...h, { question: askedQuestion, answer: result.answer }]);
      setQuestion('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to get an answer.');
    } finally {
      setAsking(false);
    }
  }

  if (children.length === 0) {
    return (
      <div>
        <div className="topbar"><h1 style={{ fontSize: '1.4rem' }}>Ask AI</h1></div>
        <div className="card">
          <EmptyState
            icon={UserCircle}
            title="No students linked"
            description="No students are linked to your account yet. Contact the school office to have your child linked."
            tone="muted"
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 style={{ fontSize: '1.4rem', marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={20} style={{ color: 'var(--accent)' }} />
            Ask AI
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '0.88rem', margin: 0 }}>
            Ask about your child&apos;s attendance, results, or fees. Answers are based only on
            their actual data - for anything else, contact the school office.
          </p>
        </div>
        {children.length > 1 && (
          <select value={studentId} onChange={(e) => setStudentId(e.target.value)} style={{ maxWidth: '220px' }}>
            {children.map((c: any) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
          </select>
        )}
      </div>

      <div className="card" style={{ marginBottom: '1.5rem', minHeight: '200px' }}>
        {history.length === 0 ? (
          <EmptyState
            icon={MessageCircleQuestion}
            title="Ask your first question"
            description={'Try "How is my child doing this term?" or "Is there an outstanding fee balance?"'}
            tone="gold"
            compact
          />
        ) : (
          history.map((entry, i) => (
            <div key={i} style={{ marginBottom: '1.2rem' }}>
              <p style={{ fontWeight: 700, fontSize: '0.9rem' }}>{entry.question}</p>
              <p style={{ fontSize: '0.9rem', color: 'var(--text)', background: 'var(--bg)', padding: '0.7rem', borderRadius: '8px' }}>
                {entry.answer}
              </p>
            </div>
          ))
        )}
      </div>

      {error && <p className="error-text">{error}</p>}

      <form onSubmit={handleAsk} style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          placeholder="Ask a question…"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={asking}
        />
        <button className="btn" type="submit" disabled={asking || !question.trim()}>
          {asking ? 'Asking…' : 'Ask'}
        </button>
      </form>
    </div>
  );
}
