export type Locale = 'en' | 'ha' | 'yo';

export const LOCALES: Locale[] = ['en', 'ha', 'yo'];

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  ha: 'Hausa',
  yo: 'Yorùbá',
};

// Best-effort translations, not reviewed by a native speaker of either
// language - see the note in language-context.tsx. Covers app chrome
// (navigation, page titles/subtitles, common actions, form field labels,
// status badges) across every role's pages. Deeply dynamic content -
// admin-authored announcement/message text, specific validation error
// strings, tooltips - is intentionally out of scope; it falls back to
// English automatically (see t() in language-context.tsx) rather than
// being silently wrong.
export interface Dictionary {
  common: {
    save: string;
    cancel: string;
    logout: string;
    loading: string;
    search: string;
    notifications: string;
    settings: string;
    print: string;
    add: string;
    new: string;
    edit: string;
    delete: string;
    remove: string;
    view: string;
    submit: string;
    close: string;
    confirm: string;
    dismiss: string;
    refresh: string;
    back: string;
    actions: string;
    noResults: string;
    tryAgain: string;
    send: string;
    sending: string;
    saving: string;
    generate: string;
    export: string;
    download: string;
    filter: string;
    all: string;
    total: string;
    greetingMorning: string;
    greetingAfternoon: string;
    greetingEvening: string;
  };
  fields: {
    name: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address: string;
    employeeId: string;
    admissionNumber: string;
    class: string;
    subject: string;
    role: string;
    status: string;
    date: string;
    gender: string;
    dateOfBirth: string;
    relationship: string;
    amount: string;
    description: string;
    title: string;
    message: string;
    recipient: string;
    student: string;
    guardian: string;
    teacher: string;
    session: string;
    term: string;
    exam: string;
    score: string;
    grade: string;
  };
  status: {
    active: string;
    inactive: string;
    present: string;
    absent: string;
    late: string;
    excused: string;
    paid: string;
    pending: string;
    partiallyPaid: string;
    overdue: string;
    sent: string;
    failed: string;
  };
  nav: {
    main: string;
    academics: string;
    assessment: string;
    finance: string;
    communication: string;
    dashboard: string;
    students: string;
    guardians: string;
    staff: string;
    classes: string;
    classSubjects: string;
    subjects: string;
    sessionsTerms: string;
    enrollments: string;
    attendance: string;
    timetable: string;
    gradingSchemes: string;
    exams: string;
    resultsEntry: string;
    enterResults: string;
    reportCards: string;
    fees: string;
    announcements: string;
    messages: string;
    deliveryLog: string;
    aiAssistant: string;
    askAi: string;
    studentFlags: string;
    aiReports: string;
    results: string;
  };
  role: {
    admin: string;
    teacher: string;
    guardian: string;
    student: string;
  };
  login: {
    welcomeBack: string;
    signInSubtitle: string;
    emailAddress: string;
    password: string;
    rememberMe: string;
    forgotPassword: string;
    signIn: string;
    headline: string;
    subheadline: string;
    portalsInOneSystem: string;
    accessAnywhere: string;
    noAccount: string;
    inviteOnlyNotice: string;
  };
  guardianDashboard: {
    welcome: string;
    trackChild: string;
    trackChildren: string;
    yourChild: string;
    yourChildren: string;
    noStudentsLinked: string;
    contactOffice: string;
    quickLinks: string;
  };
  pages: {
    students: { title: string; subtitle: string; addButton: string };
    guardians: { title: string; subtitle: string };
    staff: { title: string; subtitle: string; addButton: string };
    classes: { title: string; subtitle: string; addButton: string };
    classSubjects: { title: string; subtitle: string };
    subjects: { title: string; subtitle: string; addButton: string };
    academic: { title: string; subtitle: string };
    enrollments: { title: string; subtitle: string };
    attendance: { title: string; subtitle: string };
    timetable: { title: string; subtitle: string };
    gradingSchemes: { title: string; subtitle: string };
    exams: { title: string; subtitle: string; addButton: string };
    results: { title: string; subtitle: string };
    reportCards: { title: string; subtitle: string };
    fees: { title: string; subtitle: string };
    announcements: { title: string; subtitle: string; newButton: string };
    messages: { title: string; subtitle: string; newButton: string };
    deliveryLog: { title: string; subtitle: string };
    flags: { title: string; subtitle: string };
    aiReports: { title: string; subtitle: string };
    adminDashboard: { welcome: string };
    teacherDashboard: { welcome: string };
    studentDashboard: { welcome: string };
  };
}

const en: Dictionary = {
  common: {
    save: 'Save',
    cancel: 'Cancel',
    logout: 'Log out',
    loading: 'Loading…',
    search: 'Search…',
    notifications: 'Notifications',
    settings: 'Settings',
    print: 'Print',
    add: 'Add',
    new: 'New',
    edit: 'Edit',
    delete: 'Delete',
    remove: 'Remove',
    view: 'View',
    submit: 'Submit',
    close: 'Close',
    confirm: 'Confirm',
    dismiss: 'Dismiss',
    refresh: 'Refresh',
    back: 'Back',
    actions: 'Actions',
    noResults: 'No results found.',
    tryAgain: 'Try again',
    send: 'Send',
    sending: 'Sending…',
    saving: 'Saving…',
    generate: 'Generate',
    export: 'Export',
    download: 'Download',
    filter: 'Filter',
    all: 'All',
    total: 'Total',
    greetingMorning: 'Good morning',
    greetingAfternoon: 'Good afternoon',
    greetingEvening: 'Good evening',
  },
  fields: {
    name: 'Name',
    firstName: 'First name',
    lastName: 'Last name',
    email: 'Email',
    phone: 'Phone',
    address: 'Address',
    employeeId: 'Employee ID',
    admissionNumber: 'Admission number',
    class: 'Class',
    subject: 'Subject',
    role: 'Role',
    status: 'Status',
    date: 'Date',
    gender: 'Gender',
    dateOfBirth: 'Date of birth',
    relationship: 'Relationship',
    amount: 'Amount',
    description: 'Description',
    title: 'Title',
    message: 'Message',
    recipient: 'Recipient',
    student: 'Student',
    guardian: 'Guardian',
    teacher: 'Teacher',
    session: 'Session',
    term: 'Term',
    exam: 'Exam',
    score: 'Score',
    grade: 'Grade',
  },
  status: {
    active: 'Active',
    inactive: 'Inactive',
    present: 'Present',
    absent: 'Absent',
    late: 'Late',
    excused: 'Excused',
    paid: 'Paid',
    pending: 'Pending',
    partiallyPaid: 'Partially paid',
    overdue: 'Overdue',
    sent: 'Sent',
    failed: 'Failed',
  },
  nav: {
    main: 'Main',
    academics: 'Academics',
    assessment: 'Assessment',
    finance: 'Finance',
    communication: 'Communication',
    dashboard: 'Dashboard',
    students: 'Students',
    guardians: 'Guardians',
    staff: 'Staff',
    classes: 'Classes',
    classSubjects: 'Class Subjects',
    subjects: 'Subjects',
    sessionsTerms: 'Sessions & Terms',
    enrollments: 'Enrollments',
    attendance: 'Attendance',
    timetable: 'Timetable',
    gradingSchemes: 'Grading Schemes',
    exams: 'Exams',
    resultsEntry: 'Results Entry',
    enterResults: 'Enter Results',
    reportCards: 'Report Cards',
    fees: 'Fees',
    announcements: 'Announcements',
    messages: 'Messages',
    deliveryLog: 'Delivery Log',
    aiAssistant: 'AI Assistant',
    askAi: 'Ask AI',
    studentFlags: 'Student Flags',
    aiReports: 'AI Reports',
    results: 'Results',
  },
  role: {
    admin: 'Administrator',
    teacher: 'Teacher',
    guardian: 'Guardian',
    student: 'Student',
  },
  login: {
    welcomeBack: 'Welcome back',
    signInSubtitle: 'Sign in to continue to your portal.',
    emailAddress: 'Email address',
    password: 'Password',
    rememberMe: 'Remember me',
    forgotPassword: 'Forgot password?',
    signIn: 'Sign in',
    headline: "Every learner's journey, in one place.",
    subheadline:
      'Attendance, results, and communication for students, guardians, teachers and administrators - unified in a single portal.',
    portalsInOneSystem: 'Portals in one system',
    accessAnywhere: 'Access, anywhere',
    noAccount: 'No account?',
    inviteOnlyNotice:
      'Portal access is invite-only - the school office creates your account when your child is enrolled (or when you join as staff).',
  },
  guardianDashboard: {
    welcome: 'Welcome, {{name}}',
    trackChild: "Keep track of your child's attendance, results and fees.",
    trackChildren: "Keep track of your children's attendance, results and fees.",
    yourChild: 'Your child',
    yourChildren: 'Your children',
    noStudentsLinked: 'No students linked yet',
    contactOffice: 'Contact the school office if this looks wrong.',
    quickLinks: 'Quick links',
  },
  pages: {
    students: { title: 'Students', subtitle: 'Manage student records and enrollment', addButton: 'Add Student' },
    guardians: { title: 'Guardians', subtitle: 'Parent and guardian contact records' },
    staff: { title: 'Staff', subtitle: 'Manage teachers and staff', addButton: 'Add Staff' },
    classes: { title: 'Classes', subtitle: 'Manage school classes', addButton: 'Add Class' },
    classSubjects: { title: 'Class Subjects', subtitle: 'Assign subjects to each class' },
    subjects: { title: 'Subjects', subtitle: 'Manage the subject catalog', addButton: 'Add Subject' },
    academic: { title: 'Sessions & Terms', subtitle: 'Manage academic sessions and terms' },
    enrollments: { title: 'Enrollments', subtitle: 'Enroll students into classes' },
    attendance: { title: 'Attendance', subtitle: "View and manage students' attendance" },
    timetable: { title: 'Timetable', subtitle: 'Weekly class timetable' },
    gradingSchemes: { title: 'Grading Schemes', subtitle: 'Configure grading scales and bands' },
    exams: { title: 'Exams', subtitle: 'Manage exams', addButton: 'Add Exam' },
    results: { title: 'Results Entry', subtitle: 'Enter student exam scores' },
    reportCards: { title: 'Report Cards', subtitle: "View and print students' report cards" },
    fees: { title: 'Fees', subtitle: 'Manage school fees and payments' },
    announcements: { title: 'Announcements', subtitle: 'School announcements', newButton: 'New Announcement' },
    messages: { title: 'Messages', subtitle: 'Message guardians and teachers', newButton: 'New Message' },
    deliveryLog: { title: 'Delivery Log', subtitle: 'Every outbound email and whether it actually sent' },
    flags: { title: 'Student Flags', subtitle: 'Students who may need attention' },
    aiReports: { title: 'AI Reports', subtitle: 'Ask the AI assistant about the school' },
    adminDashboard: { welcome: 'Welcome, {{name}}' },
    teacherDashboard: { welcome: 'Welcome, {{name}}' },
    studentDashboard: { welcome: 'Welcome, {{name}}' },
  },
};

const ha: Dictionary = {
  common: {
    save: 'Ajiye',
    cancel: 'Soke',
    logout: 'Fita',
    loading: 'Ana loda…',
    search: 'Bincike…',
    notifications: 'Sanarwa',
    settings: 'Saitunan',
    print: 'Buga',
    add: 'Kara',
    new: 'Sabo',
    edit: 'Gyara',
    delete: 'Goge',
    remove: 'Cire',
    view: 'Duba',
    submit: 'Mika',
    close: 'Rufe',
    confirm: 'Tabbatar',
    dismiss: 'Watsar',
    refresh: 'Sabunta',
    back: 'Baya',
    actions: 'Ayyuka',
    noResults: 'Babu sakamako.',
    tryAgain: 'Sake gwadawa',
    send: 'Aika',
    sending: 'Ana Aikawa…',
    saving: 'Ana Ajiyewa…',
    generate: 'Kirkiro',
    export: 'Fitarwa',
    download: 'Sauke',
    filter: 'Tace',
    all: 'Duka',
    total: 'Jimla',
    greetingMorning: 'Ina kwana',
    greetingAfternoon: 'Ina wuni',
    greetingEvening: 'Ina yamma',
  },
  fields: {
    name: 'Suna',
    firstName: 'Sunan Farko',
    lastName: 'Sunan Karshe',
    email: 'Imel',
    phone: 'Waya',
    address: 'Adireshi',
    employeeId: "Lambar Ma'aikaci",
    admissionNumber: 'Lambar Shiga',
    class: 'Aji',
    subject: 'Darasi',
    role: 'Matsayi',
    status: 'Matsayi',
    date: 'Kwanan Wata',
    gender: 'Jinsi',
    dateOfBirth: 'Ranar Haihuwa',
    relationship: 'Dangantaka',
    amount: 'Adadi',
    description: 'Bayani',
    title: 'Take',
    message: 'Sako',
    recipient: 'Mai Karba',
    student: 'Dalibi',
    guardian: 'Mai Kulawa',
    teacher: 'Malami',
    session: 'Zangon Karatu',
    term: 'Zango',
    exam: 'Jarrabawa',
    score: 'Maki',
    grade: 'Digiri',
  },
  status: {
    active: 'Mai Aiki',
    inactive: 'Ba Mai Aiki Ba',
    present: 'Halarta',
    absent: 'Rashi',
    late: 'Makara',
    excused: 'An Yafe',
    paid: 'An Biya',
    pending: 'Jiran Biya',
    partiallyPaid: 'An Biya Wani Bangare',
    overdue: 'Ya Wuce Lokaci',
    sent: 'An Aika',
    failed: 'Ya Kasa',
  },
  nav: {
    main: 'Babba',
    academics: 'Ilimi',
    assessment: 'Kimantawa',
    finance: 'Kudi',
    communication: 'Sadarwa',
    dashboard: 'Gida',
    students: 'Dalibai',
    guardians: 'Masu Kulawa',
    staff: "Ma'aikata",
    classes: 'Azuzuwa',
    classSubjects: 'Darussan Aji',
    subjects: 'Darussa',
    sessionsTerms: 'Zangunan Karatu',
    enrollments: 'Rajista',
    attendance: 'Halarta',
    timetable: 'Jadawalin Lokaci',
    gradingSchemes: 'Tsarin Maki',
    exams: 'Jarrabawa',
    resultsEntry: 'Shigar da Sakamako',
    enterResults: 'Shigar da Sakamako',
    reportCards: 'Katin Rahoto',
    fees: 'Kudin Makaranta',
    announcements: 'Sanarwar Makaranta',
    messages: 'Saƙonni',
    deliveryLog: 'Rahoton Aikawa',
    aiAssistant: 'Mataimakin AI',
    askAi: 'Tambayi AI',
    studentFlags: 'Fadakarwa kan Dalibi',
    aiReports: 'Rahoton AI',
    results: 'Sakamako',
  },
  role: {
    admin: 'Mai Kulawa',
    teacher: 'Malami',
    guardian: 'Mai Kulawa',
    student: 'Dalibi',
  },
  login: {
    welcomeBack: 'Barka da Dawowa',
    signInSubtitle: 'Shiga don ci gaba zuwa dandalin ku.',
    emailAddress: 'Adireshin Imel',
    password: 'Kalmar Sirri',
    rememberMe: 'Ka Tuna Da Ni',
    forgotPassword: 'Ka manta da kalmar sirri?',
    signIn: 'Shiga',
    headline: 'Tafiyar kowane dalibi, a wuri guda.',
    subheadline:
      'Halarta, sakamako, da sadarwa ga dalibai, iyaye, malamai da shugabanni - duk a dandali guda.',
    portalsInOneSystem: 'Dandalai a tsarin guda',
    accessAnywhere: "Samun dama, ko'ina",
    noAccount: 'Babu asusu?',
    inviteOnlyNotice:
      "Shiga dandalin yana ta gayyata kawai - ofishin makaranta ne zai kirkiro asusun ku lokacin da aka yi wa ɗan/'yar ku rajista (ko lokacin da kuka shiga a matsayin ma'aikaci).",
  },
  guardianDashboard: {
    welcome: 'Barka da zuwa, {{name}}',
    trackChild: "Ku kula da halarta, sakamako da kudin makarantar ɗan/'yar ku.",
    trackChildren: "Ku kula da halarta, sakamako da kudin makarantar 'ya'yanku.",
    yourChild: 'Ɗanku/Yarku',
    yourChildren: "'Ya'yanku",
    noStudentsLinked: 'Babu ɗalibi da aka haɗa tukuna',
    contactOffice: 'Tuntuɓi ofishin makaranta idan wannan ba daidai ba ne.',
    quickLinks: 'Hanyoyin Sauri',
  },
  pages: {
    students: { title: 'Dalibai', subtitle: 'Sarrafa bayanan dalibai da rajista', addButton: 'Kara Dalibi' },
    guardians: { title: 'Masu Kulawa', subtitle: 'Bayanan iyaye da masu kula da dalibai' },
    staff: { title: "Ma'aikata", subtitle: "Sarrafa malamai da ma'aikata", addButton: "Kara Ma'aikaci" },
    classes: { title: 'Azuzuwa', subtitle: 'Sarrafa azuzuwan makaranta', addButton: 'Kara Aji' },
    classSubjects: { title: 'Darussan Aji', subtitle: 'Sanya darussa ga kowane aji' },
    subjects: { title: 'Darussa', subtitle: 'Sarrafa jerin darussa', addButton: 'Kara Darasi' },
    academic: { title: 'Zangunan Karatu', subtitle: 'Sarrafa shekarun karatu da zangaye' },
    enrollments: { title: 'Rajista', subtitle: 'Rajistar dalibai a azuzuwa' },
    attendance: { title: 'Halarta', subtitle: 'Duba da sarrafa halartar dalibai' },
    timetable: { title: 'Jadawalin Lokaci', subtitle: 'Jadawalin darussa na mako' },
    gradingSchemes: { title: 'Tsarin Maki', subtitle: 'Sanya tsarin maki da digiri' },
    exams: { title: 'Jarrabawa', subtitle: 'Sarrafa jarrabawowi', addButton: 'Kara Jarrabawa' },
    results: { title: 'Shigar da Sakamako', subtitle: 'Shigar da sakamakon dalibai' },
    reportCards: { title: 'Katin Rahoto', subtitle: 'Kalli da buga katin rahoton dalibai' },
    fees: { title: 'Kudin Makaranta', subtitle: 'Sarrafa kudin makaranta da biyan kudi' },
    announcements: { title: 'Sanarwar Makaranta', subtitle: 'Sanarwowi ga makaranta', newButton: 'Sabuwar Sanarwa' },
    messages: { title: 'Saƙonni', subtitle: 'Sadarwa da iyaye da malamai', newButton: 'Sabon Sako' },
    deliveryLog: { title: 'Rahoton Aikawa', subtitle: 'Duba dukkan sakonnin da aka aika ta imel' },
    flags: { title: 'Fadakarwa kan Dalibi', subtitle: 'Dalibai da suke bukatar kulawa' },
    aiReports: { title: 'Rahoton AI', subtitle: 'Tambayi tsarin AI game da makaranta' },
    adminDashboard: { welcome: 'Barka da zuwa, {{name}}' },
    teacherDashboard: { welcome: 'Barka da zuwa, {{name}}' },
    studentDashboard: { welcome: 'Barka da zuwa, {{name}}' },
  },
};

const yo: Dictionary = {
  common: {
    save: 'Fi pamọ́',
    cancel: 'Fagilé',
    logout: 'Jáde',
    loading: 'Ń kó sílẹ̀…',
    search: 'Wá…',
    notifications: 'Ìfitónilétí',
    settings: 'Ètò',
    print: 'Tẹ̀wé',
    add: 'Fi kún',
    new: 'Tuntun',
    edit: 'Ṣàtúnṣe',
    delete: 'Paarẹ́',
    remove: 'Yọ kúrò',
    view: 'Wò',
    submit: 'Fi ránṣẹ́',
    close: 'Ti pa',
    confirm: 'Jẹ́rìí sí',
    dismiss: 'Fi sílẹ̀',
    refresh: 'Tún ṣe',
    back: 'Padà',
    actions: 'Ìṣe',
    noResults: 'Kò sí àbájáde tí a rí.',
    tryAgain: 'Gbìyànjú padà',
    send: 'Fi ránṣẹ́',
    sending: 'Ń fi ránṣẹ́…',
    saving: 'Ń fi pamọ́…',
    generate: 'Dá sílẹ̀',
    export: 'Kó jáde',
    download: 'Gbà sílẹ̀',
    filter: 'Ṣàyẹ̀wò',
    all: 'Gbogbo',
    total: 'Àpapọ̀',
    greetingMorning: 'Ẹ kú àárọ̀',
    greetingAfternoon: 'Ẹ kú ọ̀sán',
    greetingEvening: 'Ẹ kú alẹ́',
  },
  fields: {
    name: 'Orúkọ',
    firstName: 'Orúkọ Àkọ́kọ́',
    lastName: 'Orúkọ Ìdílé',
    email: 'Ímeèlì',
    phone: 'Fóònù',
    address: 'Àdírẹ́sì',
    employeeId: 'Nọ́mbà Òṣìṣẹ́',
    admissionNumber: 'Nọ́mbà Gbígbàwọlé',
    class: 'Kíláàsì',
    subject: 'Ẹ̀kọ́',
    role: 'Ipò',
    status: 'Ipò',
    date: 'Ọjọ́',
    gender: 'Ìbálòpọ̀',
    dateOfBirth: 'Ọjọ́ Ìbí',
    relationship: 'Ìbáṣepọ̀',
    amount: 'Iye Owó',
    description: 'Àpèjúwe',
    title: 'Orúkọ Iṣẹ́',
    message: 'Ìránsé',
    recipient: 'Olùgbà',
    student: 'Akẹ́kọ̀ọ́',
    guardian: 'Alábòójútó',
    teacher: 'Olùkọ́',
    session: 'Sáà Ẹ̀kọ́',
    term: 'Sáà',
    exam: 'Àyẹ̀wò',
    score: 'Àmì',
    grade: 'Ìwọ̀n',
  },
  status: {
    active: 'Ń ṣiṣẹ́',
    inactive: 'Kò ń ṣiṣẹ́',
    present: 'Wà',
    absent: 'Kò Wà',
    late: 'Pẹ̀',
    excused: 'Àforíjì',
    paid: 'Ó ti san',
    pending: 'Ń dúró',
    partiallyPaid: 'Ó san díẹ̀',
    overdue: 'Ó ti kọjá àkókò',
    sent: 'A ti fi ránṣẹ́',
    failed: 'Kò yege',
  },
  nav: {
    main: 'Àkọ́kọ́',
    academics: 'Ẹ̀kọ́',
    assessment: 'Ìdíyelé',
    finance: 'Owó',
    communication: 'Ìbánisọ̀rọ̀',
    dashboard: 'Ilé',
    students: 'Akẹ́kọ̀ọ́',
    guardians: 'Alábòójútó',
    staff: 'Òṣìṣẹ́',
    classes: 'Kíláàsì',
    classSubjects: 'Ẹ̀kọ́ Kíláàsì',
    subjects: 'Ẹ̀kọ́',
    sessionsTerms: 'Sáà Ẹ̀kọ́',
    enrollments: 'Ìforúkọsílẹ̀',
    attendance: 'Wíwá sí Kíláàsì',
    timetable: 'Àkókò Ìwé Ìkẹ́kọ̀ọ́',
    gradingSchemes: 'Ìlànà Ìdíyelé',
    exams: 'Àyẹ̀wò',
    resultsEntry: 'Ìwọlé Àbájáde',
    enterResults: 'Ìwọlé Àbájáde',
    reportCards: 'Káàdì Ìjábọ̀',
    fees: 'Owó Ilé-Ìwé',
    announcements: 'Ìkéde',
    messages: 'Ìránsé',
    deliveryLog: 'Àkọsílẹ̀ Fífiránṣẹ́',
    aiAssistant: 'Olùrànlọ́wọ́ AI',
    askAi: 'Béèrè lọ́wọ́ AI',
    studentFlags: 'Ìkìlọ̀ Akẹ́kọ̀ọ́',
    aiReports: 'Ìjábọ̀ AI',
    results: 'Àbájáde',
  },
  role: {
    admin: 'Alákóso',
    teacher: 'Olùkọ́',
    guardian: 'Alábòójútó',
    student: 'Akẹ́kọ̀ọ́',
  },
  login: {
    welcomeBack: 'Ẹ káàbọ̀ padà',
    signInSubtitle: 'Wọlé láti tẹ̀síwájú sí abala rẹ.',
    emailAddress: 'Àdírẹ́sì Ímeèlì',
    password: 'Ọ̀rọ̀ Aṣínà',
    rememberMe: 'Rántí mi',
    forgotPassword: 'Ṣé o gbàgbé ọ̀rọ̀ aṣínà?',
    signIn: 'Wọlé',
    headline: 'Ìrìnàjò akẹ́kọ̀ọ́ kọ̀ọ̀kan, ní ibi kan.',
    subheadline:
      'Wíwá sí kíláàsì, àbájáde, àti ìbánisọ̀rọ̀ fún akẹ́kọ̀ọ́, òbí, olùkọ́ àti alábòójútó - gbogbo rẹ̀ ní pọ́tà kan.',
    portalsInOneSystem: 'Pọ́tà nínú ètò kan',
    accessAnywhere: 'Wọlé láti ibikíbi',
    noAccount: 'Kò sí àkántì?',
    inviteOnlyNotice:
      'Wíwọlé sí pọ́tà jẹ́ nípa ìkésíni nìkan - ọ́físì ilé-ìwé ni yóò ṣẹ̀dá àkántì rẹ nígbà tí a bá forúkọsílẹ̀ ọmọ rẹ (tàbí nígbà tí o bá dara pọ̀ gẹ́gẹ́ bí òṣìṣẹ́).',
  },
  guardianDashboard: {
    welcome: 'Ẹ káàbọ̀, {{name}}',
    trackChild: 'Tọ́jú àkíyèsí wíwá sí kíláàsì, àbájáde àti owó ilé-ìwé ọmọ rẹ.',
    trackChildren: 'Tọ́jú àkíyèsí wíwá sí kíláàsì, àbájáde àti owó ilé-ìwé àwọn ọmọ rẹ.',
    yourChild: 'Ọmọ rẹ',
    yourChildren: 'Àwọn ọmọ rẹ',
    noStudentsLinked: 'Kò sí akẹ́kọ̀ọ́ tí a so pọ̀ mọ́ ẹ tíì',
    contactOffice: 'Kan sí ọ́físì ilé-ìwé bí èyí kò bá tọ́.',
    quickLinks: 'Ìjápọ̀ Kíákíá',
  },
  pages: {
    students: { title: 'Akẹ́kọ̀ọ́', subtitle: 'Ṣàkóso àlàyé àti fórúkọsílẹ̀ akẹ́kọ̀ọ́', addButton: 'Fi Akẹ́kọ̀ọ́ Kún' },
    guardians: { title: 'Alábòójútó', subtitle: 'Àlàyé nípa àwọn òbí àti alábòójútó akẹ́kọ̀ọ́' },
    staff: { title: 'Òṣìṣẹ́', subtitle: 'Ṣàkóso àwọn olùkọ́ àti òṣìṣẹ́', addButton: 'Fi Òṣìṣẹ́ Kún' },
    classes: { title: 'Kíláàsì', subtitle: 'Ṣàkóso àwọn kíláàsì ilé-ìwé', addButton: 'Fi Kíláàsì Kún' },
    classSubjects: { title: 'Ẹ̀kọ́ Kíláàsì', subtitle: 'Yan ẹ̀kọ́ fún kíláàsì kọ̀ọ̀kan' },
    subjects: { title: 'Ẹ̀kọ́', subtitle: 'Ṣàkóso àtòjọ ẹ̀kọ́', addButton: 'Fi Ẹ̀kọ́ Kún' },
    academic: { title: 'Sáà Ẹ̀kọ́', subtitle: 'Ṣàkóso ọdún ẹ̀kọ́ àti sáà' },
    enrollments: { title: 'Ìforúkọsílẹ̀', subtitle: 'Fórúkọsílẹ̀ akẹ́kọ̀ọ́ sí kíláàsì' },
    attendance: { title: 'Wíwá sí Kíláàsì', subtitle: 'Wo àti ṣàkóso wíwá akẹ́kọ̀ọ́' },
    timetable: { title: 'Àkókò Ìwé Ìkẹ́kọ̀ọ́', subtitle: 'Àkókò ẹ̀kọ́ ọ̀sẹ̀' },
    gradingSchemes: { title: 'Ìlànà Ìdíyelé', subtitle: 'Ṣàtò ìlànà àmì àti ìwọ̀n' },
    exams: { title: 'Àyẹ̀wò', subtitle: 'Ṣàkóso àwọn àyẹ̀wò', addButton: 'Fi Àyẹ̀wò Kún' },
    results: { title: 'Ìwọlé Àbájáde', subtitle: 'Wọlé àbájáde akẹ́kọ̀ọ́' },
    reportCards: { title: 'Káàdì Ìjábọ̀', subtitle: 'Wo àti tẹ̀wé káàdì ìjábọ̀ akẹ́kọ̀ọ́' },
    fees: { title: 'Owó Ilé-Ìwé', subtitle: 'Ṣàkóso owó ilé-ìwé àti sísanwó' },
    announcements: { title: 'Ìkéde', subtitle: 'Àwọn ìkéde ilé-ìwé', newButton: 'Ìkéde Tuntun' },
    messages: { title: 'Ìránsé', subtitle: 'Bá àwọn òbí àti olùkọ́ sọ̀rọ̀', newButton: 'Ìránsé Tuntun' },
    deliveryLog: { title: 'Àkọsílẹ̀ Fífiránṣẹ́', subtitle: 'Wo gbogbo ìránsé tí a fi ránṣẹ́ nípa ímeèlì' },
    flags: { title: 'Ìkìlọ̀ Akẹ́kọ̀ọ́', subtitle: 'Àwọn akẹ́kọ̀ọ́ tí ó nílò àfiyèsí' },
    aiReports: { title: 'Ìjábọ̀ AI', subtitle: 'Béèrè lọ́wọ́ ètò AI nípa ilé-ìwé' },
    adminDashboard: { welcome: 'Ẹ káàbọ̀, {{name}}' },
    teacherDashboard: { welcome: 'Ẹ káàbọ̀, {{name}}' },
    studentDashboard: { welcome: 'Ẹ káàbọ̀, {{name}}' },
  },
};

export const dictionaries: Record<Locale, Dictionary> = { en, ha, yo };
