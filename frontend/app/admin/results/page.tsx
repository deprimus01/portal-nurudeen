'use client';

import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { ResultsEntry } from '../../../components/ResultsEntry';
import type { Exam, Subject } from '../../../lib/types';
import { useLanguage } from '../../../lib/i18n/language-context';

export default function AdminResultsPage() {
  const { t } = useLanguage();
  const [exams, setExams] = useState<Exam[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get<Exam[]>('/api/exams'), api.get<Subject[]>('/api/subjects')])
      .then(([e, s]) => { setExams(e); setSubjects(s); })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="topbar"><h1 style={{ fontSize: '1.4rem' }}>{t('pages.results.title')}</h1></div>

      {loading ? (
        <p style={{ color: 'var(--muted)' }}>Loading…</p>
      ) : exams.length === 0 ? (
        <div className="card"><p style={{ color: 'var(--muted)' }}>Create an exam first under Exams.</p></div>
      ) : (
        <ResultsEntry
          examOptions={exams.map((e: any) => ({ id: e.id, label: `${e.class?.name} - ${e.name} (${e.term?.session?.name} ${e.term?.name})` }))}
          subjectOptions={subjects}
        />
      )}
    </div>
  );
}
