'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart3, CheckSquare, LayoutDashboard, Megaphone, MessageSquare, Sparkles, Wallet } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { useLanguage } from '../../lib/i18n/language-context';
import { AppShell, NavGroup } from '../../components/ui/AppShell';

const MOBILE_PRIMARY = ['/guardian', '/guardian/ask', '/guardian/fees', '/guardian/messages'];

export default function GuardianLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();

  const NAV_GROUPS: NavGroup[] = useMemo(
    () => [
      { label: t('nav.main'), items: [{ href: '/guardian', label: t('nav.dashboard'), icon: LayoutDashboard }] },
      { label: t('nav.aiAssistant'), items: [{ href: '/guardian/ask', label: t('nav.askAi'), icon: Sparkles }] },
      { label: t('nav.academics'), items: [{ href: '/guardian/attendance', label: t('nav.attendance'), icon: CheckSquare }] },
      { label: t('nav.assessment'), items: [{ href: '/guardian/results', label: t('nav.results'), icon: BarChart3 }] },
      { label: t('nav.finance'), items: [{ href: '/guardian/fees', label: t('nav.fees'), icon: Wallet }] },
      {
        label: t('nav.communication'),
        items: [
          { href: '/guardian/announcements', label: t('nav.announcements'), icon: Megaphone },
          { href: '/guardian/messages', label: t('nav.messages'), icon: MessageSquare },
        ],
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
    if (user.role !== 'GUARDIAN') {
      if (user.role === 'ADMIN') router.replace('/admin');
      else if (user.role === 'TEACHER') router.replace('/teacher');
      else if (user.role === 'STUDENT') router.replace('/student');
      else router.replace('/portal-coming-soon');
    }
  }, [loading, user, router]);

  if (loading || !user || user.mustResetPassword || user.role !== 'GUARDIAN') return null;

  const profile = user.profile as { firstName?: string; lastName?: string } | null;
  const userName = profile?.firstName ? `${profile.firstName} ${profile.lastName ?? ''}`.trim() : user.email;

  return (
    <AppShell
      navGroups={NAV_GROUPS}
      roleLabel={t('role.guardian')}
      userName={userName}
      userEmail={user.email}
      onLogout={logout}
      mobilePrimaryHrefs={MOBILE_PRIMARY}
      settingsHref="/guardian/settings"
    >
      {children}
    </AppShell>
  );
}
