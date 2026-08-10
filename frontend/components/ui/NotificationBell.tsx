'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bell,
  Briefcase,
  CalendarClock,
  CheckCheck,
  ClipboardCheck,
  Layers,
  Megaphone,
  MessageSquare,
  Settings2,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { api } from '../../lib/api';
import type { AppNotification, NotificationsFeed, NotificationType } from '../../lib/types';

const EASE = [0.16, 1, 0.3, 1] as const;
const POLL_MS = 45000;

const TYPE_META: Record<NotificationType, { icon: LucideIcon; color: string; bg: string }> = {
  enrollment: { icon: Layers, color: 'var(--blue)', bg: 'rgba(0, 85, 251, 0.1)' },
  staff: { icon: Briefcase, color: 'var(--navy)', bg: 'rgba(16, 54, 125, 0.1)' },
  announcement: { icon: Megaphone, color: 'var(--gold)', bg: 'rgba(201, 151, 74, 0.14)' },
  fee: { icon: Wallet, color: 'var(--success)', bg: 'rgba(22, 163, 74, 0.1)' },
  system: { icon: Settings2, color: 'var(--muted)', bg: 'rgba(152, 162, 179, 0.14)' },
  exam: { icon: CalendarClock, color: 'var(--blue)', bg: 'rgba(0, 85, 251, 0.1)' },
  result: { icon: ClipboardCheck, color: 'var(--success)', bg: 'rgba(22, 163, 74, 0.1)' },
  attendance: { icon: ClipboardCheck, color: 'var(--warn)', bg: 'rgba(217, 119, 6, 0.1)' },
  message: { icon: MessageSquare, color: 'var(--blue)', bg: 'rgba(0, 85, 251, 0.1)' },
};

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

export function NotificationBell() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [feed, setFeed] = useState<NotificationsFeed>({ notifications: [], unreadCount: 0, reminders: [] });
  const [loading, setLoading] = useState(true);
  const wrapRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    api
      .get<NotificationsFeed>('/api/notifications?limit=20')
      .then(setFeed)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_MS);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  function markRead(notification: AppNotification) {
    if (notification.read) return;
    setFeed((f) => ({
      ...f,
      unreadCount: Math.max(0, f.unreadCount - 1),
      notifications: f.notifications.map((n) => (n.id === notification.id ? { ...n, read: true } : n)),
    }));
    api.patch(`/api/notifications/${notification.id}/read`, {}).catch(() => load());
  }

  function markAllRead() {
    if (feed.unreadCount === 0) return;
    setFeed((f) => ({ ...f, unreadCount: 0, notifications: f.notifications.map((n) => ({ ...n, read: true })) }));
    api.post('/api/notifications/read-all', {}).catch(() => load());
  }

  const hasBadge = feed.unreadCount > 0 || feed.reminders.length > 0;

  return (
    <div className="shell-notif-wrap" ref={wrapRef}>
      <button
        type="button"
        className="shell-icon-btn shell-notif-btn"
        onClick={() => setOpen((o) => !o)}
        aria-label={hasBadge ? `Notifications (${feed.unreadCount} unread)` : 'Notifications'}
      >
        <Bell size={16} />
        {hasBadge && (
          <span className="shell-notif-dot">
            {feed.unreadCount > 0 ? (feed.unreadCount > 9 ? '9+' : feed.unreadCount) : ''}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="shell-notif-panel"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.16, ease: EASE }}
          >
            <div className="shell-notif-head">
              <h4>Notifications</h4>
              {feed.unreadCount > 0 && (
                <button type="button" className="shell-notif-markall" onClick={markAllRead}>
                  <CheckCheck size={13} /> Mark all read
                </button>
              )}
            </div>

            <div className="shell-notif-list">
              {feed.reminders.map((r) => (
                <div key={r.id} className="shell-notif-item shell-notif-reminder">
                  <div className="today-icon" style={{ background: 'rgba(217, 119, 6, 0.1)', color: 'var(--warn)' }}>
                    <ClipboardCheck size={15} />
                  </div>
                  <div className="ti-text">
                    <div className="ti-title">{r.title}</div>
                    <div className="ti-sub">{r.body}</div>
                  </div>
                </div>
              ))}

              {loading ? (
                <div style={{ padding: '14px 16px' }}>
                  <div className="skeleton" style={{ height: 60 }} />
                </div>
              ) : feed.notifications.length === 0 && feed.reminders.length === 0 ? (
                <div className="shell-notif-empty">
                  <Bell size={22} style={{ color: 'var(--muted-2)' }} />
                  <p>You're all caught up</p>
                  <span>New activity relevant to your role will show up here.</span>
                </div>
              ) : (
                feed.notifications.map((n) => {
                  const meta = TYPE_META[n.type] || TYPE_META.system;
                  const Icon = meta.icon;
                  return (
                    <button
                      key={n.id}
                      type="button"
                      className={`shell-notif-item${n.read ? '' : ' unread'}`}
                      onClick={() => markRead(n)}
                    >
                      <div className="today-icon" style={{ background: meta.bg, color: meta.color }}>
                        <Icon size={15} />
                      </div>
                      <div className="ti-text">
                        <div className="ti-title">{n.title}</div>
                        <div className="ti-sub">{n.body}</div>
                      </div>
                      <div className="shell-notif-meta">
                        <span className="ti-time mono">{timeAgo(n.createdAt)}</span>
                        {!n.read && <span className="shell-notif-unread-dot" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
