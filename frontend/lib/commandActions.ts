import type { LucideIcon } from 'lucide-react';
import {
  Award,
  BarChart3,
  Briefcase,
  BookOpen,
  CheckSquare,
  ClipboardList,
  Clock,
  FileText,
  GraduationCap,
  Layers,
  Megaphone,
  MessageSquare,
  Sparkles,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';

export interface CommandAction {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  /** extra search terms for the command palette */
  keywords?: string[];
}

type Translate = (key: string) => string;

/**
 * Admin: ordered by frequency of use (most-used first). This order also
 * drives visual priority in the on-dashboard Quick Actions panel.
 */
export function buildAdminActions(): CommandAction[] {
  return [
    { id: 'add-student', label: 'Add student', href: '/admin/students', icon: UserPlus, keywords: ['enroll', 'pupil', 'new student'] },
    { id: 'add-staff', label: 'Add staff', href: '/admin/staff', icon: Briefcase, keywords: ['teacher', 'employee', 'new staff'] },
    { id: 'create-class', label: 'Create class', href: '/admin/classes', icon: Layers, keywords: ['classroom', 'new class'] },
    { id: 'create-subject', label: 'Create subject', href: '/admin/subjects', icon: BookOpen, keywords: ['course', 'new subject'] },
    { id: 'record-enrollment', label: 'Record enrollment', href: '/admin/enrollments', icon: ClipboardList, keywords: ['admission', 'enroll student'] },
    { id: 'record-fees', label: 'Record fees', href: '/admin/fees', icon: Wallet, keywords: ['payment', 'invoice', 'fee'] },
    { id: 'create-announcement', label: 'Create announcement', href: '/admin/announcements', icon: Megaphone, keywords: ['notice', 'broadcast', 'news'] },
    { id: 'send-message', label: 'Send message', href: '/admin/messages', icon: MessageSquare, keywords: ['chat', 'email', 'sms'] },
    { id: 'create-exam', label: 'Create exam', href: '/admin/exams', icon: FileText, keywords: ['test', 'assessment', 'new exam'] },
    { id: 'enter-results', label: 'Enter results', href: '/admin/results', icon: GraduationCap, keywords: ['grades', 'scores', 'marks'] },
  ];
}

/** Existing admin dashboard shortcuts that weren't in the requested set — kept, deprioritized. */
export function buildAdminSecondaryActions(): CommandAction[] {
  return [
    { id: 'report-cards', label: 'Generate report card', href: '/admin/report-cards', icon: Award, keywords: ['transcript'] },
    { id: 'timetable', label: 'Create timetable', href: '/admin/timetable', icon: Clock, keywords: ['schedule', 'periods'] },
  ];
}

export function buildTeacherActions(): CommandAction[] {
  return [
    { id: 'take-attendance', label: 'Take attendance', href: '/teacher/attendance', icon: CheckSquare, keywords: ['register', 'present', 'absent'] },
    { id: 'enter-results', label: 'Enter results', href: '/teacher/results', icon: GraduationCap, keywords: ['grades', 'scores', 'marks'] },
    { id: 'view-timetable', label: 'View timetable', href: '/teacher/timetable', icon: Clock, keywords: ['schedule', 'periods'] },
    // No dedicated student-roster route exists yet — points to the class list on the teacher dashboard.
    { id: 'view-students', label: 'View students', href: '/teacher#your-classes', icon: Users, keywords: ['roster', 'class list', 'pupils'] },
    { id: 'send-message', label: 'Send message', href: '/teacher/messages', icon: MessageSquare, keywords: ['chat', 'email'] },
  ];
}

export function buildStudentActions(t: Translate): CommandAction[] {
  return [
    { id: 'view-results', label: t('nav.results'), href: '/student/results', icon: BarChart3, keywords: ['grades', 'scores', 'marks'] },
    { id: 'view-timetable', label: t('nav.timetable'), href: '/student/timetable', icon: Clock, keywords: ['schedule', 'periods'] },
    { id: 'view-attendance', label: t('nav.attendance'), href: '/student/attendance', icon: CheckSquare, keywords: ['present', 'absent'] },
    { id: 'view-announcements', label: t('nav.announcements'), href: '/student/announcements', icon: Megaphone, keywords: ['notice', 'news'] },
    // "View messages" skipped — /student/messages route doesn't exist yet.
  ];
}

export function buildGuardianActions(t: Translate): CommandAction[] {
  return [
    // No dedicated route — jumps to the children section already on the guardian dashboard.
    { id: 'view-child', label: 'View child', href: '/guardian#your-children', icon: Users, keywords: ['ward', 'children', 'my child'] },
    { id: 'view-attendance', label: t('nav.attendance'), href: '/guardian/attendance', icon: CheckSquare, keywords: ['present', 'absent'] },
    { id: 'view-results', label: t('nav.results'), href: '/guardian/results', icon: BarChart3, keywords: ['grades', 'scores', 'marks'] },
    { id: 'view-fees', label: t('nav.fees'), href: '/guardian/fees', icon: Wallet, keywords: ['payment', 'invoice'] },
    { id: 'send-message', label: t('nav.messages'), href: '/guardian/messages', icon: MessageSquare, keywords: ['chat', 'email'] },
    { id: 'view-announcements', label: t('nav.announcements'), href: '/guardian/announcements', icon: Megaphone, keywords: ['notice', 'news'] },
  ];
}

/** Existing guardian dashboard shortcut that wasn't in the requested set — kept, deprioritized. */
export function buildGuardianSecondaryActions(t: Translate): CommandAction[] {
  return [{ id: 'ask-ai', label: t('nav.askAi'), href: '/guardian/ask', icon: Sparkles, keywords: ['assistant', 'help'] }];
}
