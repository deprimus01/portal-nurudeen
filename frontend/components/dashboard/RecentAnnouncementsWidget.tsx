'use client';

import { useEffect, useState } from 'react';
import { Megaphone } from 'lucide-react';
import { api } from '../../lib/api';
import type { Announcement } from '../../lib/types';
import { EmptyState } from '../ui/EmptyState';
import { DashboardWidget } from '../ui/DashboardWidget';
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

/**
 * Latest few notices from /api/announcements - the exact same
 * role-scoped endpoint the Announcements pages already use (backend
 * decides what each role can see; this just shows the top of that list).
 */
export function RecentAnnouncementsWidget({ href, limit = 4 }: { href: string; limit?: number }) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    api
      .get<Announcement[]>('/api/announcements')
      .then(setAnnouncements)
      .catch((err) => setError(getErrorMessage(err, 'Failed to load announcements.')))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  const recent = announcements.slice(0, limit);

  return (
    <DashboardWidget title="Recent announcements" icon={Megaphone} href={href} linkLabel="View all" loading={loading} error={error} onRetry={load}>
      {recent.length === 0 ? (
        <EmptyState icon={Megaphone} title="No announcements yet" description="School and class notices will appear here." tone="muted" compact />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {recent.map((a) => (
            <div key={a.id} className="today-item">
              <div className="today-icon" style={{ background: 'rgba(201,151,74,0.14)', color: 'var(--gold)' }}>
                <Megaphone size={15} />
              </div>
              <div className="ti-text">
                <div className="ti-title">{a.title}</div>
                <div className="ti-sub">{a.audience === 'SCHOOL_WIDE' ? 'School-wide' : a.class?.name || 'Class'}</div>
              </div>
              <div className="ti-time mono">{timeAgo(a.createdAt)}</div>
            </div>
          ))}
        </div>
      )}
    </DashboardWidget>
  );
}
