'use client';

import { useEffect, useMemo, useState } from 'react';
import { Layers } from 'lucide-react';
import { api } from '../../lib/api';
import { EmptyState } from '../ui/EmptyState';
import { DashboardWidget } from '../ui/DashboardWidget';
import { BarList } from '../ui/charts/BarList';
import { TrendLine } from '../ui/charts/TrendLine';
import { getErrorMessage } from '../../lib/errors';

const COLORS = ['var(--blue)', 'var(--navy)', 'var(--gold)', 'var(--success)', 'var(--warn)', 'var(--danger)'];

interface SummaryTerm {
  id: string;
  name: string;
  sessionName: string;
  isCurrent: boolean;
  enrollmentCount: number;
}

interface EnrollmentSummaryResponse {
  terms: SummaryTerm[];
  currentTermId: string | null;
  classDistribution: { label: string; value: number }[];
}

/**
 * Enrollment overview backed by GET /api/enrollments/summary — a single
 * aggregate request computed server-side. Previously this fetched all
 * terms then called /api/enrollments once per recent term (1 + up to 6
 * requests) to build the same chart data client side; the numbers shown
 * are unchanged.
 */
export function EnrollmentWidget({ href, title = 'Enrollment' }: { href: string; title?: string }) {
  const [summary, setSummary] = useState<EnrollmentSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    api
      .get<EnrollmentSummaryResponse>('/api/enrollments/summary')
      .then(setSummary)
      .catch((err) => setError(getErrorMessage(err, 'Failed to load enrollment data.')))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  const terms = summary?.terms ?? [];
  const currentTerm = useMemo(
    () => terms.find((t) => t.id === summary?.currentTermId),
    [terms, summary?.currentTermId],
  );

  const classDistribution = useMemo(
    () => (summary?.classDistribution ?? []).map((d, i) => ({ ...d, color: COLORS[i % COLORS.length] })),
    [summary],
  );

  const trend = useMemo(
    () =>
      terms.map((t) => ({
        x: t.name.length > 6 ? t.name.slice(0, 6) : t.name,
        fullLabel: `${t.sessionName} ${t.name}`.trim(),
        y: t.enrollmentCount,
      })),
    [terms],
  );

  return (
    <DashboardWidget title={title} icon={Layers} href={href} linkLabel="Manage enrollments" loading={loading} error={error} onRetry={load}>
      {classDistribution.length === 0 ? (
        <EmptyState icon={Layers} title="No enrollments yet" description="Enroll students into classes to see activity here." tone="muted" compact />
      ) : (
        <>
          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 8, fontWeight: 600 }}>
            Class distribution {currentTerm ? `· ${currentTerm.name}` : ''}
          </div>
          <BarList data={classDistribution} />
          {trend.filter((p) => p.y > 0).length > 1 && (
            <div style={{ marginTop: 18 }}>
              <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 6, fontWeight: 600 }}>
                Enrollment by term
              </div>
              <TrendLine points={trend} height={100} />
            </div>
          )}
        </>
      )}
    </DashboardWidget>
  );
}
