export type UserRole = 'ADMIN' | 'TEACHER' | 'GUARDIAN' | 'STUDENT';

export interface SessionUser {
  id: string;
  email: string;
  role: UserRole;
  mustResetPassword: boolean;
  profile?: Record<string, unknown> | null;
}

export interface PortalUserSummary {
  id: string;
  email: string;
  mustResetPassword: boolean;
  lastLoginAt?: string | null;
}

export interface Guardian {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  user?: PortalUserSummary | null;
}

export interface StudentGuardianLink {
  id: string;
  relationship: 'FATHER' | 'MOTHER' | 'GUARDIAN' | 'OTHER';
  isPrimary: boolean;
  guardian: Guardian;
}

export type SchoolLevel = 'NURSERY' | 'PRIMARY' | 'JUNIOR_SECONDARY' | 'SENIOR_SECONDARY';

export interface SchoolClass {
  id: string;
  name: string;
  level: SchoolLevel;
  sortOrder: number;
}

export interface Student {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  otherNames?: string | null;
  dateOfBirth: string;
  gender: 'MALE' | 'FEMALE';
  status: 'ACTIVE' | 'GRADUATED' | 'WITHDRAWN';
  currentClass?: SchoolClass | null;
  currentClassId?: string | null;
  studentGuardians: StudentGuardianLink[];
  user?: PortalUserSummary | null;
}

export interface Subject {
  id: string;
  name: string;
  code?: string | null;
}

export interface Staff {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string | null;
  role: 'TEACHER' | 'ADMIN' | 'TEACHER_ADMIN';
  staffSubjects: { subject: Subject }[];
  staffClasses: { class: SchoolClass }[];
  user?: PortalUserSummary | null;
}

export interface AcademicSession {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  terms?: Term[];
}

export interface Term {
  id: string;
  name: string;
  sessionId: string;
  session?: AcademicSession;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
}

export interface TimetableSlot {
  id: string;
  classId: string;
  class?: SchoolClass;
  dayOfWeek: 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY';
  period: number;
  label?: string | null;
  subjectId?: string | null;
  subject?: Subject | null;
  staffId?: string | null;
  staff?: { id: string; firstName: string; lastName: string } | null;
}

export interface GradingBand {
  id?: string;
  minScore: number;
  maxScore: number;
  grade: string;
  remark: string;
}

export interface GradingScheme {
  id: string;
  name: string;
  description?: string | null;
  bands: GradingBand[];
}

export interface Exam {
  id: string;
  name: string;
  termId: string;
  term?: Term;
  classId: string;
  class?: SchoolClass;
  gradingSchemeId: string;
  gradingScheme?: GradingScheme;
}

export interface ReportCardRow {
  subject: string;
  score: number | null;
  grade: string | null;
  remark: string;
}

export interface ReportCard {
  student: { id: string; name: string; admissionNumber: string };
  exam: { id: string; name: string; class: string; term: string; session: string };
  rows: ReportCardRow[];
  average: number | null;
  complete: boolean;
  comment: string | null;
}

export type AnnouncementAudience = 'SCHOOL_WIDE' | 'CLASS';

export interface Announcement {
  id: string;
  title: string;
  body: string;
  audience: AnnouncementAudience;
  classId?: string | null;
  class?: { id: string; name: string } | null;
  authorStaff?: { id: string; firstName: string; lastName: string } | null;
  createdAt: string;
}

export interface Contact {
  userId: string;
  name: string;
  role: UserRole;
  subtitle: string;
}

export interface Conversation {
  userId: string;
  name: string;
  role: UserRole;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

export interface Message {
  id: string;
  senderId: string;
  recipientId: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export interface FeeStructure {
  id: string;
  classId: string;
  class?: SchoolClass;
  termId: string;
  term?: Term;
  description: string;
  amount: number; // kobo
}

export interface Payment {
  id: string;
  invoiceId: string;
  amount: number; // kobo
  method: 'CASH' | 'BANK_TRANSFER' | 'PAYSTACK' | 'FLUTTERWAVE';
  reference?: string | null;
  paidAt: string;
}

export interface Invoice {
  id: string;
  studentId: string;
  student?: Student;
  termId: string;
  term?: Term;
  amount: number; // kobo
  dueDate: string;
  status: 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE';
  payments: Payment[];
}

export interface Flag {
  studentId: string;
  studentName: string;
  admissionNumber: string;
  className: string;
  type: 'ATTENDANCE_DECLINE' | 'PERFORMANCE_DECLINE';
  severity: 'MEDIUM' | 'HIGH';
  detail: string;
}

export interface FlagsResponse {
  term: { id: string; name: string } | null;
  flags: Flag[];
  note: string | null;
}

export interface NlReportResponse {
  supported: boolean;
  resolved?: boolean;
  message?: string;
  summary?: string;
  facts?: string;
  rows?: Record<string, string | number>[];
  truncated?: boolean;
}

export interface Enrollment {
  id: string;
  studentId: string;
  student: Student;
  classId: string;
  class: SchoolClass;
  termId: string;
  term: Term;
  status: 'ACTIVE' | 'COMPLETED' | 'TRANSFERRED';
}
