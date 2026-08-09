'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Award } from 'lucide-react';
import { api, ApiError } from '../../../lib/api';
import { ReportCardCommentBox } from '../../../components/ReportCardCommentBox';
import { ReportCardView } from '../../../components/ui/ReportCardView';
import { EmptyState } from '../../../components/ui/EmptyState';
import type { Exam, Student, ReportCard } from '../../../lib/types';
import { useLanguage } from '../../../lib/i18n/language-context';

function ReportCardsInner() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const [exams, setExams] = useState<Exam[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [examId, setExamId] = useState(searchParams.get('examId') || '');
  const [studentId, setStudentId] = useState('');
  const [report, setReport] = useState<ReportCard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Exam[]>('/api/exams').then(setExams).catch(() => {});
  }, []);

  useEffect(() => {
    if (!examId) return;
    const exam = exams.find((e: any) => e.id === examId) as any;
    if (!exam) return;
    api.get<Student[]>(`/api/students?classId=${exam.classId}`).then(setStudents).catch(() => {});
  }, [examId, exams]);

  async function loadReport() {
    if (!examId || !studentId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<ReportCard>(`/api/results/report-card?examId=${examId}&studentId=${studentId}`);
      setReport(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load report card.');
      setReport(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId, studentId]);

  return (
    <div>
      <div className="topbar no-print"><h1 className="page-title">{t('pages.reportCards.title')}</h1></div>

      <div className="card no-print" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div className="field" style={{ marginBottom: 0, minWidth: '220px' }}>
            <label htmlFor="rcExam">Exam</label>
            <select id="rcExam" value={examId} onChange={(e) => { setExamId(e.target.value); setStudentId(''); }}>
              <option value="" disabled>Select…</option>
              {exams.map((e: any) => (
                <option key={e.id} value={e.id}>{e.class?.name} - {e.name}</option>
              ))}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0, minWidth: '220px' }}>
            <label htmlFor="rcStudent">Student</label>
            <select id="rcStudent" value={studentId} onChange={(e) => setStudentId(e.target.value)} disabled={!examId}>
              <option value="" disabled>Select…</option>
              {students.map((s) => <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>)}
            </select>
          </div>
        </div>
      </div>

      {error && <p className="error-text no-print">{error}</p>}

      {loading ? (
        <div className="card no-print"><div className="skeleton" style={{ height: 200 }} /></div>
      ) : report ? (
        <ReportCardView report={report} />
      ) : (
        <div className="card no-print">
          <EmptyState icon={Award} title="No report card selected" description="Select an exam and student to view their report card." />
        </div>
      )}

      {report && (
        <div className="no-print">
          <ReportCardCommentBox examId={examId} studentId={studentId} initialComment={report.comment} />
        </div>
      )}
    </div>
  );
}

export default function ReportCardsPage() {
  return (
    <Suspense fallback={null}>
      <ReportCardsInner />
    </Suspense>
  );
}
