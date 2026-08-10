'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FileText } from 'lucide-react';
import { api } from '../../../lib/api';
import { ResultsEntry } from '../../../components/ResultsEntry';
import type { Exam, Subject } from '../../../lib/types';
import { EmptyState } from '../../../components/ui/EmptyState';
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
        <div className="card">
          <EmptyState
            icon={FileText}
            title="No exams to enter results for"
            description="Create an exam first, then come back here to enter scores."
            tone="gold"
            action={<Link href="/admin/exams" className="btn">Go to Exams</Link>}
          />
        </div>
      ) : (
        <ResultsEntry
          examOptions={exams.map((e: any) => ({ id: e.id, label: `${e.class?.name} - ${e.name} (${e.term?.session?.name} ${e.term?.name})` }))}
          subjectOptions={subjects}
        />
      )}
    </div>
  );
}
