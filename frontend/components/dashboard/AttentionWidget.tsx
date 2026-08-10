'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, TrendingDown } from 'lucide-react';
import { api } from '../../lib/api';
import type { Flag, FlagsResponse } from '../../lib/types';
import { EmptyState } from '../ui/EmptyState';
import { DashboardWidget } from '../ui/DashboardWidget';
import { getErrorMessage } from '../../lib/errors';

/**
 * Compact dashboard version of FlagsPanel - same /api/ai/flags endpoint
 * (already scoped to the teacher's own classes server-side), just the
 * top few shown here with a link through to the full /teacher/flags page.
 */
export function AttentionWidget({ href, title = 'Students requiring attention' }: { href: string; title?: string }) {
  const [flags, setFlags] = useState<Flag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<FlagsResponse>('/api/ai/flags')
      .then((res) => setFlags(res.flags))
      .catch((err) => setError(getErrorMessage(err, 'Failed to load flags.')))
      .finally(() => setLoading(false));
  }, []);

  return (
    <DashboardWidget title={title} icon={AlertTriangle} href={href} linkLabel="View all" loading={loading} error={error}>
      {flags.length === 0 ? (
        <EmptyState icon={TrendingDown} title="Nothing to flag" description="No notable attendance or performance decline right now." tone="green" compact />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {flags.slice(0, 5).map((f, i) => (
            <div key={`${f.studentId}-${f.type}-${i}`} className="today-item">
              <div className="today-icon" style={{ background: f.severity === 'HIGH' ? 'rgba(220,38,38,0.1)' : 'rgba(217,119,6,0.1)', color: f.severity === 'HIGH' ? 'var(--danger)' : 'var(--warn)' }}>
                <AlertTriangle size={15} />
              </div>
              <div className="ti-text">
                <div className="ti-title">{f.studentName}</div>
                <div className="ti-sub">{f.className} · {f.type === 'ATTENDANCE_DECLINE' ? 'Attendance' : 'Performance'} decline</div>
              </div>
              <span className={`badge ${f.severity === 'HIGH' ? 'badge-danger' : 'badge-warn'}`} style={{ fontSize: 10 }}>
                {f.severity === 'HIGH' ? 'High' : 'Medium'}
              </span>
            </div>
          ))}
        </div>
      )}
    </DashboardWidget>
  );
}
