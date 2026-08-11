'use client';

import { useEffect, useMemo, useState } from 'react';
import { Layers } from 'lucide-react';
import { api } from '../../lib/api';
import type { Enrollment, Term } from '../../lib/types';
import { EmptyState } from '../ui/EmptyState';
import { DashboardWidget } from '../ui/DashboardWidget';
import { BarList } from '../ui/charts/BarList';
import { TrendLine } from '../ui/charts/TrendLine';
import { getErrorMessage } from '../../lib/errors';

const COLORS = ['var(--blue)', 'var(--navy)', 'var(--gold)', 'var(--success)', 'var(--warn)', 'var(--danger)'];

/**
 * Enrollment overview built from /api/enrollments (already filterable by
 * termId) and /api/academic/terms - both endpoints the Enrollments page
 * already uses. Class distribution is for the current term; the trend
 * counts active enrollments per term for up to the last 6 terms.
 */
export function EnrollmentWidget({ href, title = 'Enrollment' }: { href: string; title?: string }) {
  const [terms, setTerms] = useState<Term[]>([]);
  const [byTerm, setByTerm] = useState<Map<string, Enrollment[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    api
      .get<Term[]>('/api/academic/terms')
      .then(async (allTerms) => {
        const sorted = [...allTerms].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
        const recent = sorted.slice(-6);
        setTerms(recent);
        const entries = await Promise.all(
          recent.map((t) =>
            api
              .get<Enrollment[]>(`/api/enrollments?termId=${t.id}`)
              .then((e): readonly [string, Enrollment[]] => [t.id, e])
              .catch((): readonly [string, Enrollment[]] => [t.id, []]),
          ),
        );
        setByTerm(new Map(entries));
      })
      .catch((err) => setError(getErrorMessage(err, 'Failed to load enrollment data.')))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  const currentTerm = useMemo(() => terms.find((t) => t.isCurrent) || terms[terms.length - 1], [terms]);

  const classDistribution = useMemo(() => {
    if (!currentTerm) return [];
    const list = byTerm.get(currentTerm.id) || [];
    const counts = new Map<string, number>();
    for (const e of list as any[]) {
      const name = e.class?.name || 'Unassigned';
      counts.set(name, (counts.get(name) || 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([label, value], i) => ({ label, value, color: COLORS[i % COLORS.length] }));
  }, [byTerm, currentTerm]);

  const trend = useMemo(
    () =>
      terms.map((t) => ({
        x: t.name.length > 6 ? t.name.slice(0, 6) : t.name,
        fullLabel: `${t.session?.name || ''} ${t.name}`.trim(),
        y: (byTerm.get(t.id) || []).length,
      })),
    [terms, byTerm],
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
