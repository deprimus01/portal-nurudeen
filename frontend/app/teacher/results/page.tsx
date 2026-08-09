'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../../../lib/auth-context';
import { api } from '../../../lib/api';
import { ResultsEntry } from '../../../components/ResultsEntry';
import type { Exam } from '../../../lib/types';
import { useLanguage } from '../../../lib/i18n/language-context';

export default function TeacherResultsPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const profile = user?.profile as any;
  const mySubjects = (profile?.staffSubjects || []).map((ss: any) => ss.subject);
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Exam[]>('/api/exams').then(setExams).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="topbar"><h1 style={{ fontSize: '1.4rem' }}>{t('nav.enterResults')}</h1></div>

      {mySubjects.length === 0 ? (
        <div className="card">
          <p style={{ color: 'var(--muted)' }}>
            You&apos;re not assigned to teach any subjects yet - ask an admin to assign you under Staff.
          </p>
        </div>
      ) : loading ? (
        <p style={{ color: 'var(--muted)' }}>Loading…</p>
      ) : exams.length === 0 ? (
        <div className="card"><p style={{ color: 'var(--muted)' }}>No exams have been created yet.</p></div>
      ) : (
        <ResultsEntry
          examOptions={exams.map((e: any) => ({ id: e.id, label: `${e.class?.name} - ${e.name} (${e.term?.session?.name} ${e.term?.name})` }))}
          subjectOptions={mySubjects}
        />
      )}
    </div>
  );
}
