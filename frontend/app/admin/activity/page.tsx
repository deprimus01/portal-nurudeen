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
  RefreshCw,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { api } from '../../../lib/api';
import type { ActivityEntry } from '../../../lib/types';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { getErrorMessage } from '../../../lib/errors';

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

function dayLabel(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(date, today)) return 'Today';
  if (sameDay(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
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

function groupByDay(entries: ActivityEntry[]) {
  const groups: { label: string; entries: ActivityEntry[] }[] = [];
  for (const entry of entries) {
    const label = dayLabel(entry.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.label === label) {
      last.entries.push(entry);
    } else {
      groups.push({ label, entries: [entry] });
    }
  }
  return groups;
}

/**
 * Full-page version of what used to be the dashboard's "Recent activity"
 * widget - same GET /api/notifications/activity feed (real AuditLog
 * entries), just given room to actually be a destination instead of a
 * cramped card. The endpoint caps at 100 entries server-side (see
 * backend/src/routes/notifications.routes.js), so this shows the most
 * recent 100 rather than paginating through full history.
 */
export default function ActivityPage() {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    api
      .get<{ activity: ActivityEntry[] }>('/api/notifications/activity?limit=100')
      .then((res) => setEntries(Array.isArray(res?.activity) ? res.activity : []))
      .catch((err) => setError(getErrorMessage(err, 'Failed to load activity.')))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  const groups = groupByDay(entries);

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 className="page-title" style={{ marginBottom: 4 }}>Recent activity</h1>
          <p className="page-sub" style={{ margin: 0 }}>
            Enrollments, attendance, results, payments and more — everything that has happened across the school.
          </p>
        </div>
        <button className="btn btn-outline" onClick={load} disabled={loading}>
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      <div className="card">
        {error && entries.length === 0 && !loading ? (
          <ErrorState description={error} onRetry={load} />
        ) : loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="skeleton" style={{ height: 280 }} />
          </div>
        ) : entries.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="No recent activity"
            description="Actions across the portal — enrollments, attendance, results, and more — will show up here."
            tone="muted"
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            {groups.map((group) => (
              <div key={group.label}>
                <div className="activity-date-heading">{group.label}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {group.entries.map((entry) => {
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
              </div>
            ))}
            {entries.length >= 100 && (
              <p style={{ fontSize: '0.8rem', color: 'var(--muted)', textAlign: 'center', margin: '4px 0 0' }}>
                Showing the most recent 100 actions.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
