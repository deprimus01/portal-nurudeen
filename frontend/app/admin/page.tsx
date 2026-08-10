'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Award,
  Briefcase,
  ClipboardList,
  Clock,
  LayoutDashboard,
  Layers,
  Users,
} from 'lucide-react';
import { api } from '../../lib/api';
import type { Student, Staff, SchoolClass, Guardian } from '../../lib/types';
import { StatCard } from '../../components/ui/StatCard';
import { QuickActionsHub } from '../../components/ui/QuickActionsHub';
import { WelcomeCard } from '../../components/ui/WelcomeCard';
import { buildAdminActions, buildAdminSecondaryActions } from '../../lib/commandActions';
import { useAuth } from '../../lib/auth-context';
import { useLanguage } from '../../lib/i18n/language-context';
import { FeesWidget } from '../../components/dashboard/FeesWidget';
import { EnrollmentWidget } from '../../components/dashboard/EnrollmentWidget';
import { ExamsWidget } from '../../components/dashboard/ExamsWidget';
import { AdminAttendanceWidget } from '../../components/dashboard/AdminAttendanceWidget';
import { RecentAnnouncementsWidget } from '../../components/dashboard/RecentAnnouncementsWidget';
import { ActivityFeedWidget } from '../../components/dashboard/ActivityFeedWidget';

interface Subject {
  id: string;
}

export default function AdminDashboardPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const profile = user?.profile as { firstName?: string; lastName?: string } | null;
  const [counts, setCounts] = useState<{
    students: number;
    staff: number;
    guardians: number;
    classes: number;
    subjects: number;
  } | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<Student[]>('/api/students'),
      api.get<Staff[]>('/api/staff'),
      api.get<Guardian[]>('/api/guardians').catch(() => []),
      api.get<SchoolClass[]>('/api/classes'),
      api.get<Subject[]>('/api/subjects').catch(() => []),
    ])
      .then(([students, staff, guardians, classes, subjects]) =>
        setCounts({
          students: students.length,
          staff: staff.length,
          guardians: guardians.length,
          classes: classes.length,
          subjects: subjects.length,
        }),
      )
      .catch(() => setCounts({ students: 0, staff: 0, guardians: 0, classes: 0, subjects: 0 }));
  }, []);

  return (
    <div>
      <WelcomeCard
        name={profile?.firstName || t('role.admin')}
        subtitle="Your school-wide command center — enrollment, attendance, fees and activity at a glance."
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

      <div className="grid-2">
        <ActivityFeedWidget />
        <RecentAnnouncementsWidget href="/admin/announcements" />
      </div>

      <QuickActionsHub primary={buildAdminActions()} secondary={buildAdminSecondaryActions()} />

      <div className="panel">
        <div className="panel-head">
          <h3>Getting started</h3>
        </div>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginTop: 0 }}>
          Set up the school year first, then classes and subjects, before enrolling students:
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {[
            { href: '/admin/academic', icon: Clock, text: 'Create an academic session and term' },
            { href: '/admin/classes', icon: Layers, text: 'Create your classes (Nursery 1 → SSS3)' },
            { href: '/admin/subjects', icon: Award, text: 'Create subjects' },
            { href: '/admin/staff', icon: Briefcase, text: 'Add staff and assign them to classes/subjects' },
            {
              href: '/admin/students',
              icon: ClipboardList,
              text: 'Enroll students - guardian portal accounts are created automatically',
            },
          ].map((step, i) => {
            const Icon = step.icon;
            return (
              <Link key={step.href} href={step.href} className="today-item" style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className="today-icon c-blue" style={{ background: 'rgba(0,85,251,0.1)', color: 'var(--blue)' }}>
                  <Icon size={16} />
                </div>
                <div className="ti-text">
                  <div className="ti-title">{step.text}</div>
                </div>
                <div className="ti-time mono">{i + 1}</div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
