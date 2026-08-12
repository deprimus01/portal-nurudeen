'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  Award,
  BarChart3,
  Briefcase,
  BookMarked,
  BookOpen,
  CalendarRange,
  CheckSquare,
  ClipboardList,
  Clock,
  FileText,
  LayoutDashboard,
  Layers,
  Megaphone,
  MessageSquare,
  Send,
  SlidersHorizontal,
  Sparkles,
  TrendingDown,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { useLanguage } from '../../lib/i18n/language-context';
import { AppShell, NavGroup } from '../../components/ui/AppShell';
import { buildAdminActions, buildAdminSecondaryActions } from '../../lib/commandActions';

const MOBILE_PRIMARY = ['/admin', '/admin/students', '/admin/attendance', '/admin/messages'];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();

  const NAV_GROUPS: NavGroup[] = useMemo(
    () => [
      { label: t('nav.main'), items: [{ href: '/admin', label: t('nav.dashboard'), icon: LayoutDashboard }] },
      {
        label: t('nav.academics'),
        items: [
          { href: '/admin/students', label: t('nav.students'), icon: Users },
          { href: '/admin/guardians', label: t('nav.guardians'), icon: UserCheck },
          { href: '/admin/staff', label: t('nav.staff'), icon: Briefcase },
          { href: '/admin/classes', label: t('nav.classes'), icon: Layers },
          { href: '/admin/class-subjects', label: t('nav.classSubjects'), icon: BookMarked },
          { href: '/admin/subjects', label: t('nav.subjects'), icon: BookOpen },
          { href: '/admin/academic', label: t('nav.sessionsTerms'), icon: CalendarRange },
          { href: '/admin/enrollments', label: t('nav.enrollments'), icon: ClipboardList },
          { href: '/admin/attendance', label: t('nav.attendance'), icon: CheckSquare },
          { href: '/admin/timetable', label: t('nav.timetable'), icon: Clock },
        ],
      },
      {
        label: t('nav.assessment'),
        items: [
          { href: '/admin/grading-schemes', label: t('nav.gradingSchemes'), icon: SlidersHorizontal },
          { href: '/admin/exams', label: t('nav.exams'), icon: FileText },
          { href: '/admin/results', label: t('nav.resultsEntry'), icon: BarChart3 },
          { href: '/admin/report-cards', label: t('nav.reportCards'), icon: Award },
        ],
      },
      { label: t('nav.finance'), items: [{ href: '/admin/fees', label: t('nav.fees'), icon: Wallet }] },
      {
        label: t('nav.communication'),
        items: [
          { href: '/admin/announcements', label: t('nav.announcements'), icon: Megaphone },
          { href: '/admin/messages', label: t('nav.messages'), icon: MessageSquare },
          { href: '/admin/delivery-log', label: t('nav.deliveryLog'), icon: Send },
        ],
      },
      {
        label: t('nav.aiAssistant'),
        items: [
          { href: '/admin/flags', label: t('nav.studentFlags'), icon: TrendingDown },
          { href: '/admin/ai-reports', label: t('nav.aiReports'), icon: Sparkles },
        ],
      },
      {
        label: t('nav.insights'),
        items: [{ href: '/admin/activity', label: t('nav.activity'), icon: Activity }],
      },
    ],
    [t],
  );

  const commandActions = useMemo(() => buildAdminActions(), []);
  const commandSecondaryActions = useMemo(() => buildAdminSecondaryActions(), []);

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
    if (user.role === 'TEACHER') {
      router.replace('/teacher');
      return;
    }
    if (user.role === 'GUARDIAN') {
      router.replace('/guardian');
      return;
    }
    if (user.role === 'STUDENT') {
      router.replace('/student');
      return;
    }
    if (user.role !== 'ADMIN') {
      router.replace('/portal-coming-soon');
    }
  }, [loading, user, router]);

  if (loading || !user || user.mustResetPassword || user.role !== 'ADMIN') return null;

  const profile = user.profile as { firstName?: string; lastName?: string } | null;
  const userName = profile?.firstName ? `${profile.firstName} ${profile.lastName ?? ''}`.trim() : user.email;

  return (
    <AppShell
      navGroups={NAV_GROUPS}
      roleLabel={t('role.admin')}
      userName={userName}
      userEmail={user.email}
      onLogout={logout}
      mobilePrimaryHrefs={MOBILE_PRIMARY}
      settingsHref="/admin/settings"
      commandActions={commandActions}
      commandSecondaryActions={commandSecondaryActions}
    >
      {children}
    </AppShell>
  );
}
