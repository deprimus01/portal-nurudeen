'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { api } from '../../lib/api';
import type { TimetableSlot } from '../../lib/types';
import { EmptyState } from '../ui/EmptyState';
import { DashboardWidget } from '../ui/DashboardWidget';
import { colorFor } from '../ui/TimetableGrid';
import { getErrorMessage } from '../../lib/errors';

const DAY_NAMES = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'] as const;

/**
 * Today's periods only, built from the same timetable endpoints the
 * Timetable pages already use (/api/timetable/me for a teacher,
 * /api/timetable/for-student/:id for a student or guardian) - just
 * filtered down to today's weekday client-side. No new endpoint.
 */
export function TodayScheduleWidget({
  source,
  title = "Today's timetable",
  subLabel,
}: {
  source: { kind: 'teacher' } | { kind: 'student'; studentId: string };
  title?: string;
  subLabel: (slot: TimetableSlot) => string | undefined | null;
}) {
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (source.kind === 'student' && !source.studentId) return;
    setLoading(true);
    setError(null);
    const req =
      source.kind === 'teacher'
        ? api.get<TimetableSlot[]>('/api/timetable/me')
        : api.get<TimetableSlot[]>(`/api/timetable/for-student/${source.studentId}`);
    req
      .then(setSlots)
      .catch((err) => setError(getErrorMessage(err, 'Failed to load timetable.')))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source.kind, source.kind === 'student' ? source.studentId : null]);

  const todayName = DAY_NAMES[new Date().getDay()];
  const isSchoolDay = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'].includes(todayName as string);

  const today = useMemo(
    () =>
      slots
        .filter((s) => s.dayOfWeek === todayName)
        .sort((a, b) => a.period - b.period),
    [slots, todayName],
  );

  return (
    <DashboardWidget title={title} icon={CalendarClock} loading={loading} error={error}>
      {!isSchoolDay ? (
        <EmptyState icon={CalendarClock} title="No school today" description="Enjoy the weekend." tone="muted" compact />
      ) : today.length === 0 ? (
        <EmptyState icon={CalendarClock} title="Nothing scheduled today" description="No timetable slots are set for today yet." tone="muted" compact />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {today.map((slot) => {
            const c = colorFor(slot.subject?.name || slot.subjectId || slot.label || 'x');
            return (
              <div key={slot.id} className="today-item">
                <div className="today-icon mono" style={{ background: c.bg, color: c.fg, fontSize: 12, fontWeight: 700 }}>
                  {slot.period}
                </div>
                <div className="ti-text">
                  <div className="ti-title">{slot.label || slot.subject?.name || 'Free period'}</div>
                  {subLabel(slot) && <div className="ti-sub">{subLabel(slot)}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DashboardWidget>
  );
}
