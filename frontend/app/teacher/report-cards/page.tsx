'use client';

import { useEffect, useState } from 'react';
import { Award } from 'lucide-react';
import { api } from '../../../lib/api';
import { ReportCardCommentBox } from '../../../components/ReportCardCommentBox';
import { ReportCardView } from '../../../components/ui/ReportCardView';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import type { Exam, Student, ReportCard } from '../../../lib/types';
import { useLanguage } from '../../../lib/i18n/language-context';
import { getErrorMessage } from '../../../lib/errors';

export default function TeacherReportCardsPage() {
  const { t } = useLanguage();
  const [exams, setExams] = useState<Exam[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [examId, setExamId] = useState(() => {
    if (typeof window === 'undefined') return '';
    // Deep-link support for the global search feature.
    return new URLSearchParams(window.location.search).get('examId') || '';
  });
  const [studentId, setStudentId] = useState(() => {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get('studentId') || '';
  });
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

  function loadReport() {
    if (!examId || !studentId) return;
    setLoading(true);
    setError(null);
    api.get<ReportCard>(`/api/results/report-card?examId=${examId}&studentId=${studentId}`)
      .then(setReport)
      .catch((err) => {
        setError(getErrorMessage(err, 'Failed to load report card.'));
        setReport(null);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId, studentId]);

  return (
    <div>
      <div className="topbar no-print">
        <div>
          <h1 className="page-title" style={{ marginBottom: 4 }}>{t('pages.reportCards.title')}</h1>
          <p className="page-sub" style={{ margin: 0 }}>
            View a student&apos;s report card and draft their comment. You can only act on classes
            you&apos;re assigned to.
          </p>
        </div>
      </div>

      <div className="card no-print" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div className="field" style={{ marginBottom: 0, minWidth: '220px' }}>
            <label htmlFor="trcExam">Exam</label>
            <select id="trcExam" value={examId} onChange={(e) => { setExamId(e.target.value); setStudentId(''); }}>
              <option value="" disabled>Select…</option>
              {exams.map((e: any) => (
                <option key={e.id} value={e.id}>{e.class?.name} - {e.name}</option>
              ))}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0, minWidth: '220px' }}>
            <label htmlFor="trcStudent">Student</label>
            <select id="trcStudent" value={studentId} onChange={(e) => setStudentId(e.target.value)} disabled={!examId}>
              <option value="" disabled>Select…</option>
              {students.map((s) => <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>)}
            </select>
          </div>
        </div>
      </div>

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
