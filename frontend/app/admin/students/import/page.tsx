'use client';

import Link from 'next/link';
import { History } from 'lucide-react';
import { StudentImportWizard } from '../../../../components/student-import/StudentImportWizard';

export default function AdminStudentImportPage() {
  return (
    <div>
      <div className="topbar">
        <div>
          <h1 className="page-title" style={{ marginBottom: 4 }}>Smart Student Import</h1>
          <p className="page-sub" style={{ margin: 0 }}>
            Bring in students in bulk from Excel or CSV — review and correct everything before it&rsquo;s saved.
          </p>
        </div>
        <Link href="/admin/students/import/history" className="btn btn-outline">
          <History size={15} /> Import History
        </Link>
      </div>

      <StudentImportWizard historyHref="/admin/students/import/history" />
    </div>
  );
}
