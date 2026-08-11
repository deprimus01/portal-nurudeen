'use client';

import { useEffect, useState } from 'react';
import {
  Activity,
  Award,
  Briefcase,
  CalendarClock,
  ClipboardCheck,
  Layers,
  Megaphone,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { api } from '../../lib/api';
import type { ActivityEntry } from '../../lib/types';
import { EmptyState } from '../ui/EmptyState';
import { getErrorMessage } from '../../lib/errors';

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function iconFor(detail: string): { icon: LucideIcon; color: string; bg: string } {
  if (detail.includes('attendance')) return { icon: ClipboardCheck, color: 'var(--warn)', bg: 'rgba(217, 119, 6, 0.1)' };
  if (detail.includes('announcement')) return { icon: Megaphone, color: 'var(--gold)', bg: 'rgba(201, 151, 74, 0.14)' };
  if (detail.includes('payment') || detail.includes('invoice')) return { icon: Wallet, color: 'var(--success)', bg: 'rgba(22, 163, 74, 0.1)' };
  if (detail.includes('enrolled')) return { icon: Layers, color: 'var(--blue)', bg: 'rgba(0, 85, 251, 0.1)' };
  if (detail.includes('staff')) return { icon: Briefcase, color: 'var(--navy)', bg: 'rgba(16, 54, 125, 0.1)' };
  if (detail.includes('exam')) return { icon: CalendarClock, color: 'var(--blue)', bg: 'rgba(0, 85, 251, 0.1)' };
  if (detail.includes('result')) return { icon: Award, color: 'var(--success)', bg: 'rgba(22, 163, 74, 0.1)' };
  if (detail.includes('student') || detail.includes('guardian')) return { icon: Users, color: 'var(--navy)', bg: 'rgba(16, 54, 125, 0.1)' };
  return { icon: Activity, color: 'var(--muted)', bg: 'rgba(152, 162, 179, 0.14)' };
}

/**
 * Reads the real AuditLog via GET /api/notifications/activity — the
 * previous version of this widget composed a feed client-side from
 * unrelated list endpoints because AuditLog had no read endpoint at all.
 * Admin gets the full school-wide feed; a teacher gets their own actions
 * plus activity on their assigned classes (scoped server-side).
 */
export function ActivityFeedWidget({ title = 'Recent activity' }: { title?: string }) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ activity: ActivityEntry[] }>('/api/notifications/activity?limit=8')
      // `res.activity` defensively defaulted to [] - an unexpected response
      // shape (stale offline cache, a backend hiccup that still resolves
      // 200) must never leave `entries` as undefined, since the render
      // below calls entries.length/.map unconditionally once loading
      // finishes. An uncaught throw here isn't scoped to this widget: with
      // no error boundary on the admin/teacher layout it takes down the
      // whole AppShell, sidebar included (see app/admin/error.tsx).
      .then((res) => setEntries(res?.activity ?? []))
      .catch((err) => setError(getErrorMessage(err, 'Failed to load activity.')))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="panel">
      <div className="panel-head">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Activity size={16} style={{ color: 'var(--muted)' }} />
          {title}
        </h3>
      </div>
      {error ? (
        <p className="error-text" style={{ fontSize: '0.85rem' }}>{error}</p>
      ) : loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="skeleton" style={{ height: 120 }} />
        </div>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No recent activity"
          description="Actions across the portal — enrollments, attendance, results, and more — will show up here."
          tone="muted"
          compact
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {entries.map((entry) => {
            const { icon: Icon, color, bg } = iconFor(entry.detail);
            return (
              <div key={entry.id} className="today-item">
                <div className="today-icon" style={{ background: bg, color }}>
                  <Icon size={15} />
                </div>
                <div className="ti-text">
                  <div className="ti-title">
                    {entry.actorName} {entry.detail}
                  </div>
                </div>
                <div className="ti-time mono">{timeAgo(entry.createdAt)}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
