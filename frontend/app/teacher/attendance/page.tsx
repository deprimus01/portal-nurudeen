'use client';

import { useAuth } from '../../../lib/auth-context';
import { AttendanceEntry } from '../../../components/AttendanceEntry';
import { useLanguage } from '../../../lib/i18n/language-context';

export default function TeacherAttendancePage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const profile = user?.profile as any;
  const classOptions = (profile?.staffClasses || []).map((sc: any) => sc.class);

  return (
    <div>
      <div className="topbar">
        <h1 style={{ fontSize: '1.4rem' }}>{t('pages.attendance.title')}</h1>
      </div>

      {classOptions.length === 0 ? (
        <div className="card">
          <p style={{ color: 'var(--muted)' }}>
            You haven&apos;t been assigned to any classes yet — ask an admin to assign you under Staff.
          </p>
        </div>
      ) : (
        <AttendanceEntry classOptions={classOptions} />
      )}
    </div>
  );
}
