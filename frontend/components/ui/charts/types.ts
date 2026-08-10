export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

export interface TrendPoint {
  x: string; // short label, e.g. "Wk 1", "Jan"
  y: number;
  fullLabel?: string; // shown in tooltip, e.g. full date range
}

export interface BarDatum {
  label: string;
  value: number;
  color?: string;
  sublabel?: string; // shown in tooltip
}
