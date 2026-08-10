'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Layers } from 'lucide-react';
import { api } from '../../../lib/api';
import { AttendanceEntry } from '../../../components/AttendanceEntry';
import type { SchoolClass } from '../../../lib/types';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { useLanguage } from '../../../lib/i18n/language-context';
import { getErrorMessage } from '../../../lib/errors';

export default function AdminAttendancePage() {
  const { t } = useLanguage();
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    api.get<SchoolClass[]>('/api/classes')
      .then(setClasses)
      .catch((err) => setError(getErrorMessage(err, 'Failed to load.')))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="topbar">
        <h1 style={{ fontSize: '1.4rem' }}>{t('pages.attendance.title')}</h1>
      </div>

      {loading ? (
        <p style={{ color: 'var(--muted)' }}>{t('common.loading')}</p>
      ) : error && classes.length === 0 ? (
        <div className="card">
          <ErrorState description={error} onRetry={load} />
        </div>
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
