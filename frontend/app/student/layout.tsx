'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart3, CheckSquare, Clock, LayoutDashboard, Megaphone } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { useLanguage } from '../../lib/i18n/language-context';
import { AppShell, NavGroup } from '../../components/ui/AppShell';

const MOBILE_PRIMARY = ['/student', '/student/timetable', '/student/attendance', '/student/results'];

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();

  const NAV_GROUPS: NavGroup[] = useMemo(
    () => [
      { label: t('nav.main'), items: [{ href: '/student', label: t('nav.dashboard'), icon: LayoutDashboard }] },
      {
        label: t('nav.academics'),
        items: [
          { href: '/student/timetable', label: t('nav.timetable'), icon: Clock },
          { href: '/student/attendance', label: t('nav.attendance'), icon: CheckSquare },
        ],
      },
      { label: t('nav.assessment'), items: [{ href: '/student/results', label: t('nav.results'), icon: BarChart3 }] },
      {
        label: t('nav.communication'),
        items: [{ href: '/student/announcements', label: t('nav.announcements'), icon: Megaphone }],
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
    if (user.role !== 'STUDENT') {
      if (user.role === 'ADMIN') router.replace('/admin');
      else if (user.role === 'TEACHER') router.replace('/teacher');
      else if (user.role === 'GUARDIAN') router.replace('/guardian');
    }
  }, [loading, user, router]);

  if (loading || !user || user.mustResetPassword || user.role !== 'STUDENT') return null;

  const profile = user.profile as { firstName?: string; lastName?: string } | null;
  const userName = profile?.firstName ? `${profile.firstName} ${profile.lastName ?? ''}`.trim() : user.email;

  return (
    <AppShell
      navGroups={NAV_GROUPS}
      roleLabel={t('role.student')}
      userName={userName}
      userEmail={user.email}
      onLogout={logout}
      mobilePrimaryHrefs={MOBILE_PRIMARY}
      settingsHref="/student/settings"
    >
      {children}
    </AppShell>
  );
}
