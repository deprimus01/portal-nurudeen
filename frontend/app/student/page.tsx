'use client';

import { UserCircle } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { QuickActionsHub } from '../../components/ui/QuickActionsHub';
import { WelcomeCard } from '../../components/ui/WelcomeCard';
import { buildStudentActions } from '../../lib/commandActions';
import { useLanguage } from '../../lib/i18n/language-context';
import { AttendanceWidget } from '../../components/dashboard/AttendanceWidget';
import { ResultsWidget } from '../../components/dashboard/ResultsWidget';
import { StudentExamsWidget } from '../../components/dashboard/StudentExamsWidget';
import { TodayScheduleWidget } from '../../components/dashboard/TodayScheduleWidget';
import { RecentAnnouncementsWidget } from '../../components/dashboard/RecentAnnouncementsWidget';
import { RecentActivityWidget } from '../../components/dashboard/RecentActivityWidget';

interface StudentProfile {
  id?: string;
  firstName?: string;
  lastName?: string;
  admissionNumber?: string;
  currentClass?: { name: string } | null;
}

export default function StudentDashboardPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const profile = user?.profile as StudentProfile | null;

  return (
    <div>
      <WelcomeCard
        name={profile?.firstName || t('role.student')}
        subtitle={`${profile?.currentClass?.name || 'Your class'} · today's schedule, attendance and results in one place.`}
        icon={UserCircle}
      />

      <div className="grid-2">
        <TodayScheduleWidget
          source={{ kind: 'student', studentId: profile?.id || '' }}
          subLabel={(slot) => (slot.staff ? `${slot.staff.firstName} ${slot.staff.lastName}` : undefined)}
        />

        <div className="panel">
          <div className="panel-head">
            <h3>Your details</h3>
          </div>
          <div className="today-item" style={{ borderBottom: 'none', paddingBottom: 0 }}>
            <div className="today-icon" style={{ background: 'rgba(201,151,74,0.14)', color: 'var(--gold)' }}>
              <UserCircle size={16} />
            </div>
            <div className="ti-text">
              <div className="ti-title">
                {profile?.firstName} {profile?.lastName}
              </div>
              <div className="ti-sub">
                {profile?.admissionNumber} · {profile?.currentClass?.name || 'Not assigned yet'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {profile?.id && (
        <div className="dash-widget-grid">
          <AttendanceWidget studentId={profile.id} href="/student/attendance" />
          <ResultsWidget studentId={profile.id} href="/student/results" />
          <StudentExamsWidget studentId={profile.id} href="/student/results" />
        </div>
      )}

      <div className="grid-2">
        <RecentAnnouncementsWidget href="/student/announcements" />
        <RecentActivityWidget />
      </div>

      <QuickActionsHub title={t('guardianDashboard.quickLinks')} primary={buildStudentActions(t)} />
    </div>
  );
}
