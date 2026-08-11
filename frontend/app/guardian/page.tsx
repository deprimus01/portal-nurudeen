'use client';

import { useState } from 'react';
import { Users } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { useLanguage } from '../../lib/i18n/language-context';
import { EmptyState } from '../../components/ui/EmptyState';
import { QuickActionsHub } from '../../components/ui/QuickActionsHub';
import { WelcomeCard } from '../../components/ui/WelcomeCard';
import { buildGuardianActions, buildGuardianSecondaryActions } from '../../lib/commandActions';
import { AttendanceWidget } from '../../components/dashboard/AttendanceWidget';
import { FeesWidget } from '../../components/dashboard/FeesWidget';
import { ResultsWidget } from '../../components/dashboard/ResultsWidget';
import { StudentExamsWidget } from '../../components/dashboard/StudentExamsWidget';
import { RecentAnnouncementsWidget } from '../../components/dashboard/RecentAnnouncementsWidget';
import { MessagesWidget } from '../../components/dashboard/MessagesWidget';
import { RecentActivityWidget } from '../../components/dashboard/RecentActivityWidget';

interface GuardianProfile {
  firstName?: string;
  studentGuardians?: {
    relationship: string;
    student: {
      id: string;
      firstName: string;
      lastName: string;
      admissionNumber: string;
      currentClass?: { name: string } | null;
    };
  }[];
}

export default function GuardianDashboardPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const profile = user?.profile as GuardianProfile | null;
  const children = profile?.studentGuardians || [];
  const [activeChildId, setActiveChildId] = useState('');
  const selectedStudentId = activeChildId || children[0]?.student?.id || '';

  return (
    <div>
      <WelcomeCard
        name={profile?.firstName || t('role.guardian')}
        subtitle={children.length !== 1 ? t('guardianDashboard.trackChildren') : t('guardianDashboard.trackChild')}
        icon={Users}
      />

      <div className="panel" id="your-children" style={{ marginBottom: 20, scrollMarginTop: 90 }}>
        <div className="panel-head">
          <h3>{children.length !== 1 ? t('guardianDashboard.yourChildren') : t('guardianDashboard.yourChild')}</h3>
        </div>
        {children.length === 0 ? (
          <EmptyState
            icon={Users}
            title={t('guardianDashboard.noStudentsLinked')}
            description={t('guardianDashboard.contactOffice')}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {children.map((sg, i) => (
              <div
                className="today-item"
                key={i}
                onClick={() => setActiveChildId(sg.student.id)}
                style={{ cursor: children.length > 1 ? 'pointer' : 'default', outline: selectedStudentId === sg.student.id && children.length > 1 ? '1.5px solid var(--blue)' : 'none', borderRadius: 10 }}
              >
                <div className="today-icon" style={{ background: 'rgba(0,85,251,0.1)', color: 'var(--blue)' }}>
                  <Users size={16} />
                </div>
                <div className="ti-text">
                  <div className="ti-title">
                    {sg.student.firstName} {sg.student.lastName}
                  </div>
                  <div className="ti-sub">
                    {sg.student.currentClass?.name || 'No class assigned'} · {sg.student.admissionNumber}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedStudentId && (
        <div className="dash-widget-grid">
          <AttendanceWidget studentId={selectedStudentId} href="/guardian/attendance" />
          <ResultsWidget studentId={selectedStudentId} href="/guardian/results" />
          <StudentExamsWidget studentId={selectedStudentId} href="/guardian/results" />
          <FeesWidget href="/guardian/fees" />
        </div>
      )}

      <div className="grid-2">
        <RecentAnnouncementsWidget href="/guardian/announcements" />
        <MessagesWidget href="/guardian/messages" />
      </div>

      <div style={{ marginBottom: 20 }}>
        <RecentActivityWidget />
      </div>

      <QuickActionsHub
        title={t('guardianDashboard.quickLinks')}
        primary={buildGuardianActions(t)}
        secondary={buildGuardianSecondaryActions(t)}
      />
    </div>
  );
}
