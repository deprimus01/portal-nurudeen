'use client';

import { useMemo, useState } from 'react';
import type { DonutSegment } from './types';

interface DonutProps {
  segments: DonutSegment[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  /** Value shown in the center when no segment is active. Defaults to the sum of all segment values. */
  centerValue?: string;
  formatValue?: (value: number) => string;
  onSegmentSelect?: (segment: DonutSegment | null) => void;
}

/**
 * Lightweight SVG donut chart. No animation loop, no external chart
 * library - just stroke-dasharray math. Hover (desktop) and tap (mobile)
 * both set the same `active` state so behaviour is consistent across
 * input types.
 */
export function Donut({
  segments,
  size = 132,
  strokeWidth = 16,
  centerLabel,
  centerValue,
  formatValue = (v) => String(v),
  onSegmentSelect,
}: DonutProps) {
  const [active, setActive] = useState<number | null>(null);
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const arcs = useMemo(() => {
    let offset = 0;
    return segments.map((seg, i) => {
      const fraction = total > 0 ? seg.value / total : 0;
      const dash = fraction * circumference;
      const arc = { seg, dash, offset, index: i };
      offset += dash;
      return arc;
    });
  }, [segments, total, circumference]);

  const activeSeg = active !== null ? segments[active] : null;
  const displayLabel = activeSeg ? activeSeg.label : centerLabel;
  const displayValue = activeSeg
    ? formatValue(activeSeg.value)
    : centerValue ?? formatValue(total);
  const displayPct = activeSeg && total > 0 ? Math.round((activeSeg.value / total) * 100) : null;

  function select(i: number | null) {
    setActive(i);
    onSegmentSelect?.(i !== null ? segments[i] : null);
  }

  if (total === 0) {
    return (
      <div className="donut-empty" style={{ width: size, height: size }}>
        <span>No data</span>
      </div>
    );
  }

  return (
    <div className="donut-wrap">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={segments.map((s) => `${s.label}: ${formatValue(s.value)}`).join(', ')}
      >
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--border)" strokeWidth={strokeWidth} />
          {arcs.map(({ seg, dash, offset, index }) => (
            <circle
              key={seg.label}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={active === index ? strokeWidth + 3 : strokeWidth}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
              style={{
                cursor: 'pointer',
                transition:
                  'stroke-width 0.15s var(--ease), opacity 0.15s var(--ease), stroke-dasharray 0.5s var(--ease), stroke-dashoffset 0.5s var(--ease)',
              }}
              opacity={active === null || active === index ? 1 : 0.45}
              onMouseEnter={() => select(index)}
              onMouseLeave={() => select(null)}
              onClick={() => select(active === index ? null : index)}
              tabIndex={0}
              onFocus={() => select(index)}
              onBlur={() => select(null)}
            />
          ))}
        </g>
        <text x="50%" y="47%" textAnchor="middle" className="donut-center-value" fill="var(--text)">
          {displayValue}
        </text>
        {(displayLabel || displayPct !== null) && (
          <text x="50%" y="63%" textAnchor="middle" className="donut-center-label" fill="var(--muted)">
            {displayPct !== null ? `${displayPct}% · ${displayLabel}` : displayLabel}
          </text>
        )}
      </svg>

      <ul className="donut-legend">
        {segments.map((seg, i) => (
          <li
            key={seg.label}
            className={active === i ? 'active' : undefined}
            onMouseEnter={() => select(i)}
            onMouseLeave={() => select(null)}
            onClick={() => select(active === i ? null : i)}
          >
            <span className="donut-legend-dot" style={{ background: seg.color }} />
            <span className="donut-legend-label">{seg.label}</span>
            <span className="donut-legend-value mono">{formatValue(seg.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
