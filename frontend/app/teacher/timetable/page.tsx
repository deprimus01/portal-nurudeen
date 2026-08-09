'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '../../../lib/api';
import type { TimetableSlot } from '../../../lib/types';
import { slotKey, TimetableGrid } from '../../../components/ui/TimetableGrid';
import { useLanguage } from '../../../lib/i18n/language-context';

export default function TeacherTimetablePage() {
  const { t } = useLanguage();
  const [slots, setSlots] = useState<Map<string, TimetableSlot>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<TimetableSlot[]>('/api/timetable/me')
      .then((data) => {
        const map = new Map<string, TimetableSlot>();
        data.forEach((s) => map.set(slotKey(s.dayOfWeek, s.period), s));
        setSlots(map);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load timetable.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="topbar">
        <h1 className="page-title" style={{ marginBottom: 4 }}>{t('nav.timetable')}</h1>
      </div>

      {error && <p className="error-text">{error}</p>}

      <TimetableGrid
        slots={slots}
        loading={loading}
        emptyMessage="Nothing on your timetable yet - an admin sets this up under Timetable for each class you're assigned to."
        subLabel={(slot) => (slot as any).class?.name}
      />
    </div>
  );
}
