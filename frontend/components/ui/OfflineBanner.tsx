'use client';

import { WifiOff } from 'lucide-react';

function timeAgo(ts: number): string {
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export function OfflineBanner({ cachedAt }: { cachedAt?: number }) {
  return (
    <div
      className="card"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0.6rem 0.9rem',
        marginBottom: '1rem',
        borderColor: 'var(--warn, #C9971C)',
        background: 'var(--warn-bg, rgba(201, 151, 28, 0.08))',
      }}
    >
      <WifiOff size={15} style={{ flexShrink: 0, color: 'var(--warn, #C9971C)' }} />
      <span style={{ fontSize: '0.85rem' }}>
        You&apos;re offline - showing data saved {cachedAt ? timeAgo(cachedAt) : 'earlier'}.
      </span>
    </div>
  );
}
