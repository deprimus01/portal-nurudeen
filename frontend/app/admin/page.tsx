'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Award,
  BookOpen,
  Briefcase,
  CheckSquare,
  ClipboardList,
  Clock,
  FileText,
  Layers,
  Megaphone,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import { api } from '../../lib/api';
import type { Student, Staff, SchoolClass } from '../../lib/types';
import { StatCard } from '../../components/ui/StatCard';
import { QuickAction } from '../../components/ui/QuickAction';
import { useLanguage } from '../../lib/i18n/language-context';

interface Subject {
  id: string;
}

export default function AdminDashboardPage() {
  const { t } = useLanguage();
  const [counts, setCounts] = useState<{
    students: number;
    staff: number;
    classes: number;
    subjects: number;
  } | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<Student[]>('/api/students'),
      api.get<Staff[]>('/api/staff'),
      api.get<SchoolClass[]>('/api/classes'),
      api.get<Subject[]>('/api/subjects').catch(() => []),
    ])
      .then(([students, staff, classes, subjects]) =>
        setCounts({
          students: students.length,
          staff: staff.length,
          classes: classes.length,
          subjects: subjects.length,
        }),
      )
      .catch(() => setCounts({ students: 0, staff: 0, classes: 0, subjects: 0 }));
  }, []);

  return (
    <div>
      <h1 className="page-title">{t('nav.dashboard')}</h1>
      <p className="page-sub">A quick overview of your school, and shortcuts to common tasks.</p>

      <div className="stat-grid">
        <StatCard label={t('nav.students')} value={counts?.students} href="/admin/students" icon={Users} accent="blue" index={0} />
        <StatCard label={t('nav.staff')} value={counts?.staff} href="/admin/staff" icon={Briefcase} accent="navy" index={1} />
        <StatCard label={t('nav.classes')} value={counts?.classes} href="/admin/classes" icon={Layers} accent="gold" index={2} />
        <StatCard label={t('nav.subjects')} value={counts?.subjects} href="/admin/subjects" icon={BookOpen} accent="green" index={3} />
      </div>

      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-head">
          <h3>Quick actions</h3>
        </div>
        <div className="qa-grid">
          <QuickAction label="Add student" href="/admin/students" icon={UserPlus} index={0} />
          <QuickAction label="Take attendance" href="/admin/attendance" icon={CheckSquare} index={1} />
          <QuickAction label="Create exam" href="/admin/exams" icon={FileText} index={2} />
          <QuickAction label="Add staff" href="/admin/staff" icon={Briefcase} index={3} />
          <QuickAction label="Send announcement" href="/admin/announcements" icon={Megaphone} index={4} />
          <QuickAction label="Generate report card" href="/admin/report-cards" icon={Award} index={5} />
          <QuickAction label="Manage fees" href="/admin/fees" icon={Wallet} index={6} />
          <QuickAction label="Create timetable" href="/admin/timetable" icon={Clock} index={7} />
        </div>
      </div>

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
            { href: '/admin/subjects', icon: BookOpen, text: 'Create subjects' },
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
