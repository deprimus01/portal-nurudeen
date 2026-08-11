'use client';

import { useEffect, useRef, useState } from 'react';
import { Award, Users } from 'lucide-react';
import { useAuth } from '../../../lib/auth-context';
import { api } from '../../../lib/api';
import type { Exam, ReportCard } from '../../../lib/types';
import { ReportCardView } from '../../../components/ui/ReportCardView';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { OfflineBanner } from '../../../components/ui/OfflineBanner';
import { getErrorMessage } from '../../../lib/errors';

export default function GuardianResultsPage() {
  const { user } = useAuth();
  const profile = user?.profile as any;
  const children = profile?.studentGuardians?.map((sg: any) => sg.student) || [];
  // Deep-link support for the global search feature: a search result for
  // a specific child's result can preselect both fields on load.
  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const urlStudentId = urlParams?.get('studentId') || '';
  const urlExamId = urlParams?.get('examId') || '';
  const [studentId, setStudentId] = useState(urlStudentId || children[0]?.id || '');
  const [exams, setExams] = useState<Exam[]>([]);
  const [examId, setExamId] = useState(urlExamId);
  const [report, setReport] = useState<ReportCard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cachedAt, setCachedAt] = useState<number | undefined>();
  const isFirstStudentLoad = useRef(true);

  useEffect(() => {
    if (!studentId) return;
    if (isFirstStudentLoad.current) {
      // Skip clearing the deep-linked examId on the very first run.
      isFirstStudentLoad.current = false;
    } else {
      setExamId('');
      setReport(null);
    }
    api.get<Exam[]>(`/api/exams/for-student/${studentId}`).then(setExams).catch(() => {});
  }, [studentId]);

  function loadReport() {
    if (!studentId || !examId) return;
    setLoading(true);
    setError(null);
    api.getWithCache<ReportCard>(`/api/results/report-card?studentId=${studentId}&examId=${examId}`)
      .then((res) => {
        setReport(res?.data ?? null);
        setCachedAt(res?.fromCache ? res.cachedAt : undefined);
      })
      .catch((err) => setError(getErrorMessage(err, 'Failed to load report card.')))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, examId]);

  if (children.length === 0) {
    return (
      <div>
        <div className="topbar"><h1 className="page-title">Results</h1></div>
        <div className="card"><EmptyState icon={Users} title="No students linked" description="No students are linked to your account yet." /></div>
      </div>
    );
  }

  return (
    <div>
      <div className="topbar no-print"><h1 className="page-title">Results</h1></div>

      <div className="card no-print" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          {children.length > 1 && (
            <div className="field" style={{ marginBottom: 0, minWidth: '200px' }}>
              <label htmlFor="gChild">Child</label>
              <select id="gChild" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
                {children.map((c: any) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
              </select>
            </div>
          )}
          <div className="field" style={{ marginBottom: 0, minWidth: '220px' }}>
            <label htmlFor="gExam">Exam</label>
            <select id="gExam" value={examId} onChange={(e) => setExamId(e.target.value)} disabled={exams.length === 0}>
              <option value="" disabled>{exams.length === 0 ? 'No exams yet' : 'Select…'}</option>
              {exams.map((e: any) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {cachedAt !== undefined && <div className="no-print"><OfflineBanner cachedAt={cachedAt} /></div>}

      {loading ? (
        <div className="card no-print"><div className="skeleton" style={{ height: 200 }} /></div>
      ) : report ? (
        <ReportCardView report={report} />
      ) : error ? (
        <div className="card no-print">
          <ErrorState description={error} onRetry={loadReport} />
        </div>
      ) : (
        <div className="card no-print">
          <EmptyState icon={Award} title="No report card selected" description="Select an exam to view the report card." />
        </div>
      )}
    </div>
  );
}
