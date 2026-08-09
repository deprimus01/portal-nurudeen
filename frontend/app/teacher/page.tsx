'use client';

import Link from 'next/link';
import { CheckSquare, GraduationCap, Users } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { EmptyState } from '../../components/ui/EmptyState';
import { QuickAction } from '../../components/ui/QuickAction';
import { WelcomeCard } from '../../components/ui/WelcomeCard';
import { useLanguage } from '../../lib/i18n/language-context';

export default function TeacherDashboardPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const profile = user?.profile as any;
  const classes = profile?.staffClasses?.map((sc: any) => sc.class) || [];

  return (
    <div>
      <WelcomeCard
        name={profile?.firstName || t('role.teacher')}
        subtitle="Here's a quick look at your classes and common tasks."
        icon={GraduationCap}
      />

      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-head">
          <h3>Your classes</h3>
        </div>
        {classes.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No classes assigned yet"
            description="Ask an admin to assign you to a class under Staff."
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {classes.map((c: any) => (
              <Link
                key={c.id}
                href={`/teacher/attendance?classId=${c.id}`}
                className="today-item"
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div className="today-icon" style={{ background: 'rgba(0,85,251,0.1)', color: 'var(--blue)' }}>
                  <GraduationCap size={16} />
                </div>
                <div className="ti-text">
                  <div className="ti-title">{c.name}</div>
                  <div className="ti-sub">Tap to take attendance</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>{t('common.actions')}</h3>
        </div>
        <div className="qa-grid">
          <QuickAction label={t('nav.attendance')} href="/teacher/attendance" icon={CheckSquare} index={0} />
          <QuickAction label={t('nav.enterResults')} href="/teacher/results" icon={GraduationCap} index={1} />
        </div>
      </div>
    </div>
  );
}
