'use client';

import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

export type EmptyStateTone = 'blue' | 'navy' | 'gold' | 'green' | 'muted';

const TONE_STYLES: Record<EmptyStateTone, { bg: string; fg: string }> = {
  blue: { bg: 'radial-gradient(circle, rgba(0, 85, 251, 0.12), transparent 70%)', fg: 'var(--blue)' },
  navy: { bg: 'radial-gradient(circle, rgba(16, 54, 125, 0.12), transparent 70%)', fg: 'var(--navy)' },
  gold: { bg: 'radial-gradient(circle, rgba(201, 151, 74, 0.16), transparent 70%)', fg: 'var(--gold)' },
  green: { bg: 'radial-gradient(circle, rgba(22, 163, 74, 0.12), transparent 70%)', fg: 'var(--success)' },
  muted: { bg: 'radial-gradient(circle, rgba(152, 162, 179, 0.14), transparent 70%)', fg: 'var(--muted-2)' },
};

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  /** Primary action (e.g. "Add Student") - only pass this where the viewer's role can actually create the missing data. */
  action?: React.ReactNode;
  /** Secondary, lower-emphasis guidance - e.g. a link to where the data actually gets created. */
  hint?: React.ReactNode;
  /** Color accent for the icon badge, chosen per page context. Defaults to 'blue'. */
  tone?: EmptyStateTone;
  /** Use a smaller footprint for embedded/compact contexts (dashboard widgets, side panels). */
  compact?: boolean;
}

export function EmptyState({ icon: Icon, title, description, action, hint, tone = 'blue', compact = false }: EmptyStateProps) {
  const { bg, fg } = TONE_STYLES[tone];
  return (
    <motion.div
      className={`empty-state${compact ? ' empty-state-compact' : ''}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="empty-illustration" style={{ background: bg }}>
        <Icon size={compact ? 26 : 40} color={fg} strokeWidth={1.75} />
      </div>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
      {hint && <div className="empty-hint">{hint}</div>}
    </motion.div>
  );
}
