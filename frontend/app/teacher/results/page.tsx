'use client';

import { useEffect, useState } from 'react';
import { BookOpen, FileText } from 'lucide-react';
import { useAuth } from '../../../lib/auth-context';
import { api } from '../../../lib/api';
import { ResultsEntry } from '../../../components/ResultsEntry';
import type { Exam } from '../../../lib/types';
import { useLanguage } from '../../../lib/i18n/language-context';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { getErrorMessage } from '../../../lib/errors';

export default function TeacherResultsPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const profile = user?.profile as any;
  const mySubjects = (profile?.staffSubjects || []).map((ss: any) => ss.subject);
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    api.get<Exam[]>('/api/exams')
      .then(setExams)
      .catch((err) => setError(getErrorMessage(err, 'Failed to load.')))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="topbar"><h1 style={{ fontSize: '1.4rem' }}>{t('nav.enterResults')}</h1></div>

      {mySubjects.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={BookOpen}
            title="No subjects assigned yet"
            description="Ask an admin to assign you to teach a subject under Staff before you can enter results."
            tone="green"
          />
        </div>
      ) : loading ? (
        <p style={{ color: 'var(--muted)' }}>Loading…</p>
      ) : error && exams.length === 0 ? (
        <div className="card">
          <ErrorState description={error} onRetry={load} />
        </div>
      ) : exams.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={FileText}
            title="No exams yet"
            description="Once an admin creates an exam for your class, it will appear here for entering results."
            tone="gold"
          />
        </div>
      ) : (
        <ResultsEntry
          examOptions={exams.map((e: any) => ({ id: e.id, label: `${e.class?.name} - ${e.name} (${e.term?.session?.name} ${e.term?.name})` }))}
          subjectOptions={mySubjects}
        />
      )}
    </div>
  );
}
