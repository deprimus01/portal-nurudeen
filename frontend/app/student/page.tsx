'use client';

import { BarChart3, CheckSquare, Clock, Megaphone, UserCircle } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { QuickAction } from '../../components/ui/QuickAction';
import { WelcomeCard } from '../../components/ui/WelcomeCard';
import { useLanguage } from '../../lib/i18n/language-context';

interface StudentProfile {
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
        subtitle="Your details and shortcuts to your timetable, attendance and results."
        icon={UserCircle}
      />

      <div className="panel" style={{ marginBottom: 20 }}>
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

      <div className="panel">
        <div className="panel-head">
          <h3>{t('guardianDashboard.quickLinks')}</h3>
        </div>
        <div className="qa-grid">
          <QuickAction label={t('nav.timetable')} href="/student/timetable" icon={Clock} index={0} />
          <QuickAction label={t('nav.attendance')} href="/student/attendance" icon={CheckSquare} index={1} />
          <QuickAction label={t('nav.results')} href="/student/results" icon={BarChart3} index={2} />
          <QuickAction label={t('nav.announcements')} href="/student/announcements" icon={Megaphone} index={3} />
        </div>
      </div>
    </div>
  );
}
