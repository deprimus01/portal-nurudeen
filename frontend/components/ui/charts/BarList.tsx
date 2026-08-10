'use client';

import { useState } from 'react';
import type { BarDatum } from './types';

interface BarListProps {
  data: BarDatum[];
  formatValue?: (value: number) => string;
  onBarSelect?: (datum: BarDatum | null) => void;
  maxValue?: number; // override auto-scaling, e.g. to keep a 0-100 score axis
}

/**
 * Lightweight vertical bar chart built from plain divs (no SVG needed for
 * straight bars). Hover and tap both reveal the exact value via an
 * always-rendered tooltip line under the chart, so mobile users don't
 * need a floating tooltip that can clip off-screen.
 */
export function BarList({ data, formatValue = (v) => String(v), onBarSelect, maxValue }: BarListProps) {
  const [active, setActive] = useState<number | null>(null);
  const max = maxValue ?? Math.max(...data.map((d) => d.value), 1);

  function select(i: number | null) {
    setActive(i);
    onBarSelect?.(i !== null ? data[i] : null);
  }

  if (data.length === 0) {
    return <div className="bars-empty">No data</div>;
  }

  const activeDatum = active !== null ? data[active] : null;

  return (
    <div className="bars-wrap">
      <div className="bars-track">
        {data.map((d, i) => {
          const pct = Math.max((d.value / max) * 100, d.value > 0 ? 3 : 0);
          return (
            <div
              key={d.label}
              className={`bar-col ${active === i ? 'active' : ''}`}
              onMouseEnter={() => select(i)}
              onMouseLeave={() => select(null)}
              onClick={() => select(active === i ? null : i)}
              role="button"
              tabIndex={0}
            >
              <div className="bar-fill-track">
                <div
                  className="bar-fill"
                  style={{ height: `${pct}%`, background: d.color || 'var(--blue)' }}
                />
              </div>
              <span className="bar-label">{d.label}</span>
            </div>
          );
        })}
      </div>
      <div className="bars-tooltip">
        {activeDatum
          ? `${activeDatum.label}: ${formatValue(activeDatum.value)}${activeDatum.sublabel ? ` · ${activeDatum.sublabel}` : ''}`
          : '\u00A0'}
      </div>
    </div>
  );
}
