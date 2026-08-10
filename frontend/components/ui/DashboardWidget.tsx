'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowUpRight, LucideIcon } from 'lucide-react';
import { ReactNode, useId } from 'react';

const EASE = [0.16, 1, 0.3, 1] as const;

interface DashboardWidgetProps {
  title: string;
  icon?: LucideIcon;
  href?: string;
  linkLabel?: string;
  /** Right-aligned controls, e.g. a range selector or a select dropdown. */
  controls?: ReactNode;
  loading?: boolean;
  error?: string | null;
  children: ReactNode;
}

export function DashboardWidget({ title, icon: Icon, href, linkLabel = 'View details', controls, loading, error, children }: DashboardWidgetProps) {
  return (
    <div className="panel dash-widget">
      <div className="panel-head dash-widget-head">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {Icon && <Icon size={16} style={{ color: 'var(--muted)' }} />}
          {title}
        </h3>
        {controls && <div className="dash-widget-controls">{controls}</div>}
      </div>

      {error ? (
        <p className="error-text" style={{ fontSize: '0.85rem' }}>{error}</p>
      ) : loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="skeleton" style={{ height: 120 }} />
        </div>
      ) : (
        children
      )}

      {href && (
        <Link href={href} className="dash-widget-link">
          {linkLabel} <ArrowUpRight size={13} />
        </Link>
      )}
    </div>
  );
}

export function RangeTabs<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  const pillId = useId();
  return (
    <div className="range-tabs" role="tablist">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            className={active ? 'active' : ''}
            onClick={() => onChange(opt.value)}
          >
            {active && (
              <motion.span
                className="range-tab-pill"
                layoutId={`rangeTabPill-${pillId}`}
                transition={{ duration: 0.22, ease: EASE }}
              />
            )}
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
