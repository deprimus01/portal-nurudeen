'use client';

import Link from 'next/link';
import { Upload } from 'lucide-react';
import { ImportHistory } from '../../../../../components/student-import/ImportHistory';

export default function TeacherImportHistoryPage() {
  return (
    <div>
      <div className="topbar">
        <div>
          <h1 className="page-title" style={{ marginBottom: 4 }}>Import History</h1>
          <p className="page-sub" style={{ margin: 0 }}>
            Your Smart Student Import batches, with what happened to each one.
          </p>
        </div>
        <Link href="/teacher/students/import" className="btn">
          <Upload size={15} /> New Import
        </Link>
      </div>

      <ImportHistory />
    </div>
  );
}
