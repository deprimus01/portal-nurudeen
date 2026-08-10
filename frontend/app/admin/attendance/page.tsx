'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Layers } from 'lucide-react';
import { api } from '../../../lib/api';
import { AttendanceEntry } from '../../../components/AttendanceEntry';
import type { SchoolClass } from '../../../lib/types';
import { EmptyState } from '../../../components/ui/EmptyState';
import { useLanguage } from '../../../lib/i18n/language-context';

export default function AdminAttendancePage() {
  const { t } = useLanguage();
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<SchoolClass[]>('/api/classes')
      .then(setClasses)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="topbar">
        <h1 style={{ fontSize: '1.4rem' }}>{t('pages.attendance.title')}</h1>
      </div>

      {loading ? (
        <p style={{ color: 'var(--muted)' }}>{t('common.loading')}</p>
      ) : classes.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Layers}
            title="No classes to mark attendance for"
            description="Create a class first, then come back here to take attendance."
            tone="navy"
            action={<Link href="/admin/classes" className="btn">Go to Classes</Link>}
          />
        </div>
      ) : (
        <AttendanceEntry classOptions={classes} />
      )}
    </div>
  );
}
