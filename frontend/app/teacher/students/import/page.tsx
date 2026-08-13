'use client';

import Link from 'next/link';
import { History } from 'lucide-react';
import { StudentImportWizard } from '../../../../components/student-import/StudentImportWizard';

export default function TeacherStudentImportPage() {
  return (
    <div>
      <div className="topbar">
        <div>
          <h1 className="page-title" style={{ marginBottom: 4 }}>Smart Student Import</h1>
          <p className="page-sub" style={{ margin: 0 }}>
            Bring in students in bulk from Excel or CSV — review and correct everything before it&rsquo;s saved.
            You can only import into classes you&rsquo;re assigned to.
          </p>
        </div>
        <Link href="/teacher/students/import/history" className="btn btn-outline">
          <History size={15} /> Import History
        </Link>
      </div>

      <StudentImportWizard historyHref="/teacher/students/import/history" />
    </div>
  );
}
