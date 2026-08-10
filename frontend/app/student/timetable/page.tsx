'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../../../lib/auth-context';
import { api } from '../../../lib/api';
import type { TimetableSlot } from '../../../lib/types';
import { slotKey, TimetableGrid } from '../../../components/ui/TimetableGrid';
import { useLanguage } from '../../../lib/i18n/language-context';
import { getErrorMessage } from '../../../lib/errors';

export default function StudentTimetablePage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const studentId = (user?.profile as { id?: string } | null)?.id;
  const [slots, setSlots] = useState<Map<string, TimetableSlot>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    if (!studentId) return;
    setLoading(true);
    setError(null);
    api.get<TimetableSlot[]>(`/api/timetable/for-student/${studentId}`)
      .then((data) => {
        const map = new Map<string, TimetableSlot>();
        data.forEach((s) => map.set(slotKey(s.dayOfWeek, s.period), s));
        setSlots(map);
      })
      .catch((err) => setError(getErrorMessage(err, 'Failed to load timetable.')))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [studentId]);

  return (
    <div>
      <div className="topbar">
        <h1 className="page-title" style={{ marginBottom: 4 }}>{t('nav.timetable')}</h1>
      </div>

      <TimetableGrid
        slots={slots}
        loading={loading}
        emptyMessage="Nothing on your timetable yet - check back once your class schedule is set up."
        subLabel={(slot) => ((slot as any).staff ? `${(slot as any).staff.firstName} ${(slot as any).staff.lastName}` : undefined)}
        error={error}
        onRetry={load}
      />
    </div>
  );
}
