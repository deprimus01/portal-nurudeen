'use client';

import { useState } from 'react';
import type { TrendPoint } from './types';

interface TrendLineProps {
  points: TrendPoint[];
  height?: number;
  color?: string;
  formatValue?: (value: number) => string;
  suffix?: string; // e.g. '%'
}

/**
 * Lightweight SVG line + area chart. Renders a fixed-width viewBox that
 * scales via CSS, so it stays crisp and cheap at any container size.
 * Hover (desktop) and tap (mobile) both resolve to the nearest point.
 */
export function TrendLine({ points, height = 120, color = 'var(--blue)', formatValue = (v) => String(v), suffix = '' }: TrendLineProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const width = 320;
  const padX = 10;
  const padY = 16;

  if (points.length === 0) {
    return (
      <div className="trend-empty" style={{ height }}>
        <span>No data for this range</span>
      </div>
    );
  }

  const values = points.map((p) => p.y);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;

  const coords = points.map((p, i) => {
    const x = points.length === 1 ? width / 2 : padX + (i / (points.length - 1)) * (width - padX * 2);
    const y = padY + (1 - (p.y - min) / range) * (height - padY * 2);
    return { x, y, point: p };
  });

  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');
  const areaPath = `${linePath} L ${coords[coords.length - 1].x} ${height - padY} L ${coords[0].x} ${height - padY} Z`;

  function handlePointer(clientX: number, svgEl: SVGSVGElement) {
    const rect = svgEl.getBoundingClientRect();
    const relX = ((clientX - rect.left) / rect.width) * width;
    let nearest = 0;
    let nearestDist = Infinity;
    coords.forEach((c, i) => {
      const d = Math.abs(c.x - relX);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = i;
      }
    });
    setActiveIndex(nearest);
  }

  const active = activeIndex !== null ? coords[activeIndex] : null;

  return (
    <div className="trend-wrap">
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Trend from ${formatValue(values[0])} to ${formatValue(values[values.length - 1])}`}
        onMouseMove={(e) => handlePointer(e.clientX, e.currentTarget)}
        onMouseLeave={() => setActiveIndex(null)}
        onTouchStart={(e) => handlePointer(e.touches[0].clientX, e.currentTarget)}
        onTouchMove={(e) => handlePointer(e.touches[0].clientX, e.currentTarget)}
        onTouchEnd={() => setTimeout(() => setActiveIndex(null), 1200)}
      >
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#trendFill)" stroke="none" />
        <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {active && (
          <line x1={active.x} y1={padY} x2={active.x} y2={height - padY} stroke="var(--border)" strokeWidth={1} />
        )}
        {coords.map((c, i) => (
          <circle
            key={i}
            cx={c.x}
            cy={c.y}
            r={activeIndex === i ? 4 : 2.5}
            fill={activeIndex === i ? color : 'var(--surface)'}
            stroke={color}
            strokeWidth={1.5}
          />
        ))}
      </svg>
      <div className="trend-axis">
        {points.map((p, i) => (
          <span key={i} className={activeIndex === i ? 'active' : undefined}>
            {p.x}
          </span>
        ))}
      </div>
      <div className="trend-tooltip">
        {active
          ? `${active.point.fullLabel || active.point.x}: ${formatValue(active.point.y)}${suffix}`
          : `Latest: ${formatValue(values[values.length - 1])}${suffix}`}
      </div>
    </div>
  );
}
