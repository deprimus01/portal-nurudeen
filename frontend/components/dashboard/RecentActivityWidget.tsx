'use client';

import { useEffect, useState } from 'react';
import { Activity } from 'lucide-react';
import { api } from '../../lib/api';
import type { NotificationsFeed } from '../../lib/types';
import { DashboardWidget } from '../ui/DashboardWidget';
import { EmptyState } from '../ui/EmptyState';
import { getErrorMessage } from '../../lib/errors';
import { TYPE_META, timeAgo } from '../ui/NotificationBell';

/**
 * Personal "what's happened for me" timeline for Student/Guardian
 * dashboards. The audit-log-based ActivityFeedWidget (admin/teacher) is
 * school-wide and deliberately out of reach for these roles, so this reads
 * the same per-user feed the notification bell uses (GET /api/notifications)
 * instead of a separate endpoint. Every row is something that already
 * triggered a real notifyX() write in the backend (results, attendance,
 * fees, announcements, messages) — nothing here is invented client-side.
 */
export function RecentActivityWidget({ title = 'Recent activity', limit = 6 }: { title?: string; limit?: number }) {
  const [feed, setFeed] = useState<NotificationsFeed | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    api
      .get<NotificationsFeed>(`/api/notifications?limit=${limit}`)
      .then(setFeed)
      .catch((err) => setError(getErrorMessage(err, 'Failed to load activity.')))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const entries = feed?.notifications ?? [];

  return (
    <DashboardWidget title={title} icon={Activity} loading={loading} error={error} onRetry={load}>
      {entries.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No recent activity"
          description="Updates about attendance, results, fees, and announcements will show up here as they happen."
          tone="muted"
          compact
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {entries.map((n) => {
            const meta = TYPE_META[n.type] || TYPE_META.system;
            const Icon = meta.icon;
            return (
              <div key={n.id} className="today-item">
                <div className="today-icon" style={{ background: meta.bg, color: meta.color }}>
                  <Icon size={15} />
                </div>
                <div className="ti-text">
                  <div className="ti-title">{n.title}</div>
                  <div className="ti-sub">{n.body}</div>
                </div>
                <div className="ti-time mono">{timeAgo(n.createdAt)}</div>
              </div>
            );
          })}
        </div>
      )}
    </DashboardWidget>
  );
}
