'use client';

import { BarChart3, CheckSquare, Megaphone, MessageSquare, Sparkles, Users, Wallet } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { useLanguage } from '../../lib/i18n/language-context';
import { EmptyState } from '../../components/ui/EmptyState';
import { QuickAction } from '../../components/ui/QuickAction';

interface GuardianProfile {
  firstName?: string;
  studentGuardians?: {
    relationship: string;
    student: {
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

  return (
    <div>
      <h1 className="page-title">{t('guardianDashboard.welcome', { name: profile?.firstName || t('role.guardian') })}</h1>
      <p className="page-sub">{children.length !== 1 ? t('guardianDashboard.trackChildren') : t('guardianDashboard.trackChild')}</p>

      <div className="panel" style={{ marginBottom: 20 }}>
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
              <div className="today-item" key={i}>
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

      <div className="panel">
        <div className="panel-head">
          <h3>{t('guardianDashboard.quickLinks')}</h3>
        </div>
        <div className="qa-grid">
          <QuickAction label={t('nav.askAi')} href="/guardian/ask" icon={Sparkles} index={0} />
          <QuickAction label={t('nav.attendance')} href="/guardian/attendance" icon={CheckSquare} index={1} />
          <QuickAction label={t('nav.results')} href="/guardian/results" icon={BarChart3} index={2} />
          <QuickAction label={t('nav.fees')} href="/guardian/fees" icon={Wallet} index={3} />
          <QuickAction label={t('nav.announcements')} href="/guardian/announcements" icon={Megaphone} index={4} />
          <QuickAction label={t('nav.messages')} href="/guardian/messages" icon={MessageSquare} index={5} />
        </div>
      </div>
    </div>
  );
}
