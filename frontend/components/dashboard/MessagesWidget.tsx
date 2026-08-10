'use client';

import { useEffect, useMemo, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { api } from '../../lib/api';
import type { Conversation } from '../../lib/types';
import { EmptyState } from '../ui/EmptyState';
import { DashboardWidget } from '../ui/DashboardWidget';
import { getErrorMessage } from '../../lib/errors';

/**
 * Built from /api/messages/conversations - the same endpoint the
 * Messages inbox already uses, including its per-conversation unread
 * counts. Nothing computed here that the backend doesn't already return.
 */
export function MessagesWidget({ href, title = 'Messages' }: { href: string; title?: string }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Conversation[]>('/api/messages/conversations')
      .then(setConversations)
      .catch((err) => setError(getErrorMessage(err, 'Failed to load messages.')))
      .finally(() => setLoading(false));
  }, []);

  const sorted = useMemo(
    () => [...conversations].sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()),
    [conversations],
  );
  const unreadTotal = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  return (
    <DashboardWidget title={title} icon={MessageSquare} href={href} linkLabel="Open messages" loading={loading} error={error}>
      {sorted.length === 0 ? (
        <EmptyState icon={MessageSquare} title="No conversations yet" description="Messages with teachers and the school will appear here." tone="muted" compact />
      ) : (
        <>
          {unreadTotal > 0 && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 14 }}>
              <span className="mono" style={{ fontSize: 26, fontWeight: 700 }}>{unreadTotal}</span>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>unread message{unreadTotal === 1 ? '' : 's'}</span>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {sorted.slice(0, 4).map((c) => (
              <div key={c.userId} className="today-item">
                <div className="today-icon" style={{ background: 'rgba(0,85,251,0.1)', color: 'var(--blue)' }}>
                  <MessageSquare size={15} />
                </div>
                <div className="ti-text">
                  <div className="ti-title">{c.name}</div>
                  <div className="ti-sub">{c.lastMessage}</div>
                </div>
                {c.unreadCount > 0 && <span className="badge badge-danger" style={{ fontSize: 10 }}>{c.unreadCount}</span>}
              </div>
            ))}
          </div>
        </>
      )}
    </DashboardWidget>
  );
}
