'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, Layers, Megaphone, Wallet } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import type { Announcement, Enrollment, Invoice } from '../../lib/types';
import { EmptyState } from '../ui/EmptyState';
import { DashboardWidget } from '../ui/DashboardWidget';

interface ActivityItem {
  id: string;
  at: string;
  icon: typeof Layers;
  color: string;
  bg: string;
  title: string;
  sub: string;
}

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
 * There's no dedicated activity-log endpoint exposed to the admin (the
 * AuditLog table is write-only from the API's perspective). Rather than
 * invent one, this composes a feed from records the admin already has
 * access to and that already carry a timestamp: new enrollments
 * (/api/enrollments), fee payments (/api/fees/invoices), and posted
 * announcements (/api/announcements) - each item here traces back to a
 * real row, just re-sorted into one combined, most-recent-first list.
 */
export function ActivityFeedWidget({ title = 'Recent activity' }: { title?: string }) {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<Enrollment[]>('/api/enrollments').catch(() => []),
      api.get<Invoice[]>('/api/fees/invoices').catch(() => []),
      api.get<Announcement[]>('/api/announcements').catch(() => []),
    ])
      .then(([e, i, a]) => {
        setEnrollments(e);
        setInvoices(i);
        setAnnouncements(a);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load activity.'))
      .finally(() => setLoading(false));
  }, []);

  const items = useMemo(() => {
    const list: ActivityItem[] = [];

    for (const e of enrollments as any[]) {
      const at = e.createdAt;
      if (!at) continue;
      list.push({
        id: `enr-${e.id}`,
        at,
        icon: Layers,
        color: 'var(--blue)',
        bg: 'rgba(0, 85, 251, 0.1)',
        title: `${e.student?.firstName || ''} ${e.student?.lastName || ''} enrolled`.trim(),
        sub: `${e.class?.name || 'Class'} · ${e.term?.name || ''}`.trim(),
      });
    }

    for (const inv of invoices as any[]) {
      for (const p of inv.payments || []) {
        list.push({
          id: `pay-${p.id}`,
          at: p.paidAt,
          icon: Wallet,
          color: 'var(--success)',
          bg: 'rgba(22, 163, 74, 0.1)',
          title: `Fee payment · \u20a6${Math.round(p.amount / 100).toLocaleString()}`,
          sub: inv.student ? `${inv.student.firstName} ${inv.student.lastName}` : 'Fees',
        });
      }
    }

    for (const a of announcements) {
      list.push({
        id: `ann-${a.id}`,
        at: a.createdAt,
        icon: Megaphone,
        color: 'var(--gold)',
        bg: 'rgba(201, 151, 74, 0.14)',
        title: `Announcement posted · ${a.title}`,
        sub: a.audience === 'SCHOOL_WIDE' ? 'School-wide' : a.class?.name || 'Class',
      });
    }

    return list.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 8);
  }, [enrollments, invoices, announcements]);

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
      ) : items.length === 0 ? (
        <EmptyState icon={Activity} title="No recent activity" description="New enrollments, payments and announcements will show up here." tone="muted" compact />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.id} className="today-item">
                <div className="today-icon" style={{ background: item.bg, color: item.color }}>
                  <Icon size={15} />
                </div>
                <div className="ti-text">
                  <div className="ti-title">{item.title}</div>
                  <div className="ti-sub">{item.sub}</div>
                </div>
                <div className="ti-time mono">{timeAgo(item.at)}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
