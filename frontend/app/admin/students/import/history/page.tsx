'use client';

import Link from 'next/link';
import { Upload } from 'lucide-react';
import { ImportHistory } from '../../../../../components/student-import/ImportHistory';

export default function AdminImportHistoryPage() {
  return (
    <div>
      <div className="topbar">
        <div>
          <h1 className="page-title" style={{ marginBottom: 4 }}>Import History</h1>
          <p className="page-sub" style={{ margin: 0 }}>
            Every Smart Student Import batch, with what happened to each one.
          </p>
        </div>
        <Link href="/admin/students/import" className="btn">
          <Upload size={15} /> New Import
        </Link>
      </div>

      <ImportHistory />
    </div>
  );
}
