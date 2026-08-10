'use client';

import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import type { TimetableSlot } from '../../../lib/types';
import { slotKey, TimetableGrid } from '../../../components/ui/TimetableGrid';
import { useLanguage } from '../../../lib/i18n/language-context';
import { getErrorMessage } from '../../../lib/errors';

export default function TeacherTimetablePage() {
  const { t } = useLanguage();
  const [slots, setSlots] = useState<Map<string, TimetableSlot>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    api.get<TimetableSlot[]>('/api/timetable/me')
      .then((data) => {
        const map = new Map<string, TimetableSlot>();
        data.forEach((s) => map.set(slotKey(s.dayOfWeek, s.period), s));
        setSlots(map);
      })
      .catch((err) => setError(getErrorMessage(err, 'Failed to load timetable.')))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="topbar">
        <h1 className="page-title" style={{ marginBottom: 4 }}>{t('nav.timetable')}</h1>
      </div>

      <TimetableGrid
        slots={slots}
        loading={loading}
        emptyMessage="Nothing on your timetable yet - an admin sets this up under Timetable for each class you're assigned to."
        subLabel={(slot) => (slot as any).class?.name}
        error={error}
        onRetry={load}
      />
    </div>
  );
}
