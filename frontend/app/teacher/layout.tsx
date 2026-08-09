'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Award, BarChart3, CheckSquare, Clock, LayoutDashboard, Megaphone, MessageSquare, TrendingDown } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { useLanguage } from '../../lib/i18n/language-context';
import { AppShell, NavGroup } from '../../components/ui/AppShell';

const MOBILE_PRIMARY = ['/teacher', '/teacher/attendance', '/teacher/results', '/teacher/messages'];

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();

  const NAV_GROUPS: NavGroup[] = useMemo(
    () => [
      { label: t('nav.main'), items: [{ href: '/teacher', label: t('nav.dashboard'), icon: LayoutDashboard }] },
      {
        label: t('nav.academics'),
        items: [
          { href: '/teacher/attendance', label: t('nav.attendance'), icon: CheckSquare },
          { href: '/teacher/timetable', label: t('nav.timetable'), icon: Clock },
        ],
      },
      {
        label: t('nav.assessment'),
        items: [
          { href: '/teacher/results', label: t('nav.enterResults'), icon: BarChart3 },
          { href: '/teacher/report-cards', label: t('nav.reportCards'), icon: Award },
        ],
      },
      {
        label: t('nav.communication'),
        items: [
          { href: '/teacher/announcements', label: t('nav.announcements'), icon: Megaphone },
          { href: '/teacher/messages', label: t('nav.messages'), icon: MessageSquare },
        ],
      },
      {
        label: t('nav.aiAssistant'),
        items: [{ href: '/teacher/flags', label: t('nav.studentFlags'), icon: TrendingDown }],
      },
    ],
    [t],
  );

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (user.mustResetPassword) {
      router.replace('/reset-password');
      return;
    }
    if (user.role !== 'TEACHER') {
      if (user.role === 'ADMIN') router.replace('/admin');
      else if (user.role === 'GUARDIAN') router.replace('/guardian');
      else if (user.role === 'STUDENT') router.replace('/student');
      else router.replace('/portal-coming-soon');
    }
  }, [loading, user, router]);

  if (loading || !user || user.mustResetPassword || user.role !== 'TEACHER') return null;

  const profile = user.profile as { firstName?: string; lastName?: string } | null;
  const userName = profile?.firstName ? `${profile.firstName} ${profile.lastName ?? ''}`.trim() : user.email;

  return (
    <AppShell
      navGroups={NAV_GROUPS}
      roleLabel={t('role.teacher')}
      userName={userName}
      userEmail={user.email}
      onLogout={logout}
      mobilePrimaryHrefs={MOBILE_PRIMARY}
      settingsHref="/teacher/settings"
    >
      {children}
    </AppShell>
  );
}
