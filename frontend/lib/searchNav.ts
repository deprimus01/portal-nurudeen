import type { SearchResultItem, SearchResultType, UserRole } from './types';

// Fixed display order for grouped results — most-frequently-needed people
// first, financial/record-keeping data last.
export const SEARCH_CATEGORY_ORDER: SearchResultType[] = [
  'STUDENT',
  'GUARDIAN',
  'STAFF',
  'CLASS',
  'SUBJECT',
  'EXAM',
  'RESULT',
  'ANNOUNCEMENT',
  'MESSAGE',
  'FEE',
];

export const SEARCH_CATEGORY_LABELS: Record<SearchResultType, string> = {
  STUDENT: 'Students',
  GUARDIAN: 'Guardians',
  STAFF: 'Staff',
  CLASS: 'Classes',
  SUBJECT: 'Subjects',
  EXAM: 'Exams',
  RESULT: 'Results',
  ANNOUNCEMENT: 'Announcements',
  MESSAGE: 'Messages',
  FEE: 'Fees',
};

// Singular label shown as the little type tag on each result row, matching
// the "Student / Muhammad Ahmed / JSS 2A" shape from the brief.
export const SEARCH_TYPE_LABELS: Record<SearchResultType, string> = {
  STUDENT: 'Student',
  GUARDIAN: 'Guardian',
  STAFF: 'Staff',
  CLASS: 'Class',
  SUBJECT: 'Subject',
  EXAM: 'Exam',
  RESULT: 'Result',
  ANNOUNCEMENT: 'Announcement',
  MESSAGE: 'Message',
  FEE: 'Fee',
};

// Where a search result sends the user when clicked. Every target here is
// an existing page — this file only ever composes query strings for pages
// that either already read them (report-cards' ?examId=) or that gained a
// small, additive ?param on-mount read as part of this feature (see the
// list/announcements/messages pages). Nothing here creates a new page.
export function searchResultHref(item: SearchResultItem, role: UserRole): string | null {
  const base = `/${role.toLowerCase()}`;

  switch (item.type) {
    case 'STUDENT':
      if (role === 'ADMIN') return `/admin/students?q=${encodeURIComponent(item.meta || item.title)}`;
      if (role === 'TEACHER') return `/teacher/report-cards?studentId=${item.id}`;
      return null;

    case 'GUARDIAN':
      if (role === 'ADMIN') return `/admin/guardians?q=${encodeURIComponent(item.subtitle || item.title)}`;
      return null;

    case 'STAFF':
      if (role === 'ADMIN') return `/admin/staff?q=${encodeURIComponent(item.meta || item.title)}`;
      return null;

    case 'CLASS':
      if (role === 'ADMIN') return `/admin/classes?q=${encodeURIComponent(item.title)}`;
      return null;

    case 'SUBJECT':
      if (role === 'ADMIN') return `/admin/subjects?q=${encodeURIComponent(item.title)}`;
      return null;

    case 'EXAM':
      if (role === 'ADMIN') return `/admin/report-cards?examId=${item.examId || item.id}`;
      if (role === 'TEACHER') return `/teacher/report-cards?examId=${item.examId || item.id}`;
      return null;

    case 'RESULT': {
      const examId = item.examId;
      const studentId = item.studentId;
      if (!examId) return null;
      if (role === 'ADMIN') return `/admin/report-cards?examId=${examId}${studentId ? `&studentId=${studentId}` : ''}`;
      if (role === 'TEACHER') return `/teacher/report-cards?examId=${examId}${studentId ? `&studentId=${studentId}` : ''}`;
      if (role === 'GUARDIAN') return `/guardian/results?examId=${examId}${studentId ? `&studentId=${studentId}` : ''}`;
      if (role === 'STUDENT') return `/student/results?examId=${examId}`;
      return null;
    }

    case 'ANNOUNCEMENT':
      return `${base}/announcements?highlight=${item.id}`;

    case 'MESSAGE':
      if (role === 'ADMIN' || role === 'TEACHER' || role === 'GUARDIAN') {
        return `${base}/messages?userId=${item.userId || item.id}&name=${encodeURIComponent(item.title)}`;
      }
      return null;

    case 'FEE':
      if (role === 'ADMIN') return `/admin/fees${item.studentId ? `?studentId=${item.studentId}` : ''}`;
      if (role === 'GUARDIAN') return `/guardian/fees${item.studentId ? `?studentId=${item.studentId}` : ''}`;
      return null;

    default:
      return null;
  }
}
