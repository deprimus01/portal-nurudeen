'use client';

import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import type { TimetableSlot } from '../../lib/types';

export const DAYS: TimetableSlot['dayOfWeek'][] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
export const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];

export function slotKey(day: string, period: number) {
  return `${day}-${period}`;
}

const PALETTE = [
  { bg: 'rgba(0, 85, 251, 0.1)', fg: '#0055FB', bd: 'rgba(0, 85, 251, 0.25)' },
  { bg: 'rgba(201, 151, 74, 0.14)', fg: '#B8863E', bd: 'rgba(201, 151, 74, 0.3)' },
  { bg: 'rgba(22, 163, 74, 0.1)', fg: '#16A34A', bd: 'rgba(22, 163, 74, 0.25)' },
  { bg: 'rgba(220, 38, 38, 0.1)', fg: '#DC2626', bd: 'rgba(220, 38, 38, 0.22)' },
  { bg: 'rgba(147, 51, 234, 0.1)', fg: '#9333EA', bd: 'rgba(147, 51, 234, 0.25)' },
  { bg: 'rgba(8, 145, 178, 0.1)', fg: '#0891B2', bd: 'rgba(8, 145, 178, 0.25)' },
  { bg: 'rgba(217, 119, 6, 0.1)', fg: '#D97706', bd: 'rgba(217, 119, 6, 0.25)' },
  { bg: 'rgba(219, 39, 119, 0.1)', fg: '#DB2777', bd: 'rgba(219, 39, 119, 0.22)' },
];

export function colorFor(key: string) {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

interface TimetableGridProps {
  slots: Map<string, TimetableSlot>;
  loading: boolean;
  emptyMessage: string;
  /** secondary line inside a lesson block — e.g. teacher name or class name */
  subLabel: (slot: TimetableSlot) => string | undefined | null;
  onCellClick?: (day: string, period: number) => void;
}

export function TimetableGrid({ slots, loading, emptyMessage, subLabel, onCellClick }: TimetableGridProps) {
  if (loading) {
    return (
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 40 }} />
        ))}
      </div>
    );
  }

  if (slots.size === 0 && !onCellClick) {
    return (
      <div className="card">
        <p style={{ color: 'var(--muted)', margin: 0 }}>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="tt-wrap">
      <div className="tt-grid" style={{ gridTemplateColumns: `64px repeat(${DAYS.length}, minmax(120px, 1fr))` }}>
        <div className="tt-corner" />
        {DAYS.map((d) => (
          <div key={d} className="tt-day-head">{d.slice(0, 3)}</div>
        ))}

        {PERIODS.map((p) => (
          <>
            <div key={`p-${p}`} className="tt-period-head">{p}</div>
            {DAYS.map((d) => {
              const slot = slots.get(slotKey(d, p));
              const clickable = !!onCellClick;
              const content = slot ? (
                slot.label ? (
                  <div className="tt-block tt-block-label">
                    <span className="badge">{slot.label}</span>
                  </div>
                ) : (
                  (() => {
                    const c = colorFor(slot.subject?.name || slot.subjectId || 'x');
                    return (
                      <div
                        className="tt-block"
                        style={{ background: c.bg, borderColor: c.bd, color: c.fg }}
                      >
                        <div className="tt-block-subject">{slot.subject?.name}</div>
                        {subLabel(slot) && <div className="tt-block-sub">{subLabel(slot)}</div>}
                      </div>
                    );
                  })()
                )
              ) : clickable ? (
                <div className="tt-block tt-block-empty">
                  <Plus size={14} />
                </div>
              ) : (
                <div className="tt-block tt-block-blank">—</div>
              );

              return (
                <motion.div
                  key={slotKey(d, p)}
                  className={`tt-cell${clickable ? ' clickable' : ''}`}
                  onClick={clickable ? () => onCellClick!(d, p) : undefined}
                  whileHover={clickable ? { scale: 1.03 } : undefined}
                  whileTap={clickable ? { scale: 0.97 } : undefined}
                  transition={{ duration: 0.15 }}
                >
                  {content}
                </motion.div>
              );
            })}
          </>
        ))}
      </div>
    </div>
  );
}
