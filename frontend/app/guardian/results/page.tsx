'use client';

import { useEffect, useState } from 'react';
import { Award, Users } from 'lucide-react';
import { useAuth } from '../../../lib/auth-context';
import { api, ApiError } from '../../../lib/api';
import type { Exam, ReportCard } from '../../../lib/types';
import { ReportCardView } from '../../../components/ui/ReportCardView';
import { EmptyState } from '../../../components/ui/EmptyState';
import { OfflineBanner } from '../../../components/ui/OfflineBanner';

export default function GuardianResultsPage() {
  const { user } = useAuth();
  const profile = user?.profile as any;
  const children = profile?.studentGuardians?.map((sg: any) => sg.student) || [];
  const [studentId, setStudentId] = useState(children[0]?.id || '');
  const [exams, setExams] = useState<Exam[]>([]);
  const [examId, setExamId] = useState('');
  const [report, setReport] = useState<ReportCard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cachedAt, setCachedAt] = useState<number | undefined>();

  useEffect(() => {
    if (!studentId) return;
    setExamId('');
    setReport(null);
    api.get<Exam[]>(`/api/exams/for-student/${studentId}`).then(setExams).catch(() => {});
  }, [studentId]);

  useEffect(() => {
    if (!studentId || !examId) return;
    setLoading(true);
    setError(null);
    api.getWithCache<ReportCard>(`/api/results/report-card?studentId=${studentId}&examId=${examId}`)
      .then((res) => {
        setReport(res.data);
        setCachedAt(res.fromCache ? res.cachedAt : undefined);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load report card.'))
      .finally(() => setLoading(false));
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

      {error && <p className="error-text no-print">{error}</p>}
      {cachedAt !== undefined && <div className="no-print"><OfflineBanner cachedAt={cachedAt} /></div>}

      {loading ? (
        <div className="card no-print"><div className="skeleton" style={{ height: 200 }} /></div>
      ) : report ? (
        <ReportCardView report={report} />
      ) : (
        <div className="card no-print">
          <EmptyState icon={Award} title="No report card selected" description="Select an exam to view the report card." />
        </div>
      )}
    </div>
  );
}
