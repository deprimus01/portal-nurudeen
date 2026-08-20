'use client';

import { useEffect, useState } from 'react';
import {
  Award,
  Briefcase,
  LayoutDashboard,
  Layers,
  Users,
} from 'lucide-react';
import { api } from '../../lib/api';
import type { DashboardSummary } from '../../lib/types';
import { StatCard } from '../../components/ui/StatCard';
import { WelcomeCard } from '../../components/ui/WelcomeCard';
import { useAuth } from '../../lib/auth-context';
import { useLanguage } from '../../lib/i18n/language-context';
import { FeesWidget } from '../../components/dashboard/FeesWidget';
import { EnrollmentWidget } from '../../components/dashboard/EnrollmentWidget';
import { ExamsWidget } from '../../components/dashboard/ExamsWidget';
import { AdminAttendanceWidget } from '../../components/dashboard/AdminAttendanceWidget';
import { RecentAnnouncementsWidget } from '../../components/dashboard/RecentAnnouncementsWidget';
import { OnboardingSetup } from '../../components/dashboard/OnboardingSetup';

export default function AdminDashboardPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const profile = user?.profile as { firstName?: string; lastName?: string } | null;
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [summaryError, setSummaryError] = useState(false);
  const counts = summary?.counts ?? null;

  // Single lightweight COUNT-backed request replaces what used to be 10
  // full-list fetches split across this page and OnboardingSetup
  // (students/staff/guardians/classes/subjects/sessions, each fetched
  // once for stat cards and again for setup-progress checks) — see
  // backend/src/routes/dashboard.routes.js. OnboardingSetup no longer
  // fetches on its own; it reads `summary.setup` from this same request.
  function loadSummary() {
    setSummaryError(false);
    api
      .get<DashboardSummary>('/api/dashboard/summary')
      .then(setSummary)
      .catch(() => setSummaryError(true));
  }

  useEffect(() => {
    loadSummary();
  }, []);

  return (
    <div>
      <WelcomeCard
        name={profile?.firstName || t('role.admin')}
        subtitle="Your school-wide command center — enrollment, attendance, and fees at a glance."
        icon={LayoutDashboard}
      />

      <div className="stat-grid">
        <StatCard label={t('nav.students')} value={counts?.students} href="/admin/students" icon={Users} accent="blue" index={0} />
        <StatCard label={t('nav.staff')} value={counts?.staff} href="/admin/staff" icon={Briefcase} accent="navy" index={1} />
        <StatCard label="Guardians" value={counts?.guardians} href="/admin/guardians" icon={Users} accent="gold" index={2} />
        <StatCard label={t('nav.classes')} value={counts?.classes} href="/admin/classes" icon={Layers} accent="green" index={3} />
        <StatCard label={t('nav.subjects')} value={counts?.subjects} href="/admin/subjects" icon={Award} accent="blue" index={4} />
      </div>

      <div className="dash-widget-grid">
        <AdminAttendanceWidget href="/admin/attendance" />
        <EnrollmentWidget href="/admin/enrollments" />
        <ExamsWidget href="/admin/exams" title="Upcoming exams" />
        <FeesWidget href="/admin/fees" />
      </div>

      <RecentAnnouncementsWidget href="/admin/announcements" />

      <OnboardingSetup setup={summary?.setup ?? null} error={summaryError} onRetry={loadSummary} />
    </div>
  );
}
