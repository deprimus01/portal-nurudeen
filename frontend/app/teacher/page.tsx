'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { GraduationCap, Users } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { api } from '../../lib/api';
import type { Exam } from '../../lib/types';
import { EmptyState } from '../../components/ui/EmptyState';
import { QuickActionsHub } from '../../components/ui/QuickActionsHub';
import { WelcomeCard } from '../../components/ui/WelcomeCard';
import { buildTeacherActions } from '../../lib/commandActions';
import { useLanguage } from '../../lib/i18n/language-context';
import { ExamsWidget } from '../../components/dashboard/ExamsWidget';
import { ClassPerformanceWidget } from '../../components/dashboard/ClassPerformanceWidget';
import { PendingResultsWidget } from '../../components/dashboard/PendingResultsWidget';
import { TodayScheduleWidget } from '../../components/dashboard/TodayScheduleWidget';
import { AttentionWidget } from '../../components/dashboard/AttentionWidget';
import { RecentAnnouncementsWidget } from '../../components/dashboard/RecentAnnouncementsWidget';
import { ActivityFeedWidget } from '../../components/dashboard/ActivityFeedWidget';

export default function TeacherDashboardPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const profile = user?.profile as any;
  const classes = profile?.staffClasses?.map((sc: any) => sc.class) || [];
  const mySubjects = (profile?.staffSubjects || []).map((ss: any) => ss.subject);
  const [exams, setExams] = useState<Exam[]>([]);

  useEffect(() => {
    api.get<Exam[]>('/api/exams').then(setExams).catch(() => {});
  }, []);

  return (
    <div>
      <WelcomeCard
        name={profile?.firstName || t('role.teacher')}
        subtitle="Here's today's schedule, your classes, and what needs your attention."
        icon={GraduationCap}
      />

      <div className="grid-2">
        <TodayScheduleWidget
          source={{ kind: 'teacher' }}
          subLabel={(slot) => slot.class?.name}
        />

        <div className="panel" id="your-classes">
          <div className="panel-head">
            <h3>Your classes</h3>
          </div>
          {classes.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No classes assigned yet"
              description="Ask an admin to assign you to a class under Staff."
              tone="muted"
              compact
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
      </div>

      <div className="dash-widget-grid">
        <PendingResultsWidget exams={exams} subjects={mySubjects} href="/teacher/results" />
        <ClassPerformanceWidget exams={exams} subjects={mySubjects} href="/teacher/results" />
        <ExamsWidget href="/teacher/report-cards" title="Upcoming exams" />
      </div>

      <div className="grid-2">
        <AttentionWidget href="/teacher/flags" />
        <RecentAnnouncementsWidget href="/teacher/announcements" />
      </div>

      <ActivityFeedWidget />

      <QuickActionsHub title={t('common.actions')} primary={buildTeacherActions()} />
    </div>
  );
}
