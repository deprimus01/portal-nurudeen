'use client';

import { Users } from 'lucide-react';
import { useAuth } from '../../../lib/auth-context';
import { AttendanceEntry } from '../../../components/AttendanceEntry';
import { useLanguage } from '../../../lib/i18n/language-context';
import { EmptyState } from '../../../components/ui/EmptyState';

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
          <EmptyState
            icon={Users}
            title="No classes assigned yet"
            description="Ask an admin to assign you to a class under Staff before you can take attendance."
            tone="navy"
          />
        </div>
      ) : (
        <AttendanceEntry classOptions={classOptions} />
      )}
    </div>
  );
}
