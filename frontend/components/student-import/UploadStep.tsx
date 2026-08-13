'use client';

import { useCallback, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Download, FileSpreadsheet, Loader2, Upload as UploadIcon } from 'lucide-react';
import { uploadImportFile, downloadImportTemplate } from '../../lib/studentImportApi';
import { getErrorMessage } from '../../lib/errors';

const EASE = [0.16, 1, 0.3, 1] as const;
const ACCEPTED_EXTENSIONS = ['.xlsx', '.xls', '.csv', '.docx', '.pdf'];
const MAX_FILE_BYTES = 10 * 1024 * 1024;

interface UploadStepProps {
  onUploaded: (batchId: string) => void;
}

function isAcceptedFile(file: File) {
  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  return ACCEPTED_EXTENSIONS.includes(ext);
}

export function UploadStep({ onUploaded }: UploadStepProps) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templateDownloading, setTemplateDownloading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(null);

    if (!isAcceptedFile(file)) {
      setError('Please upload an Excel (.xlsx, .xls), CSV, Word (.docx), or PDF file.');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError('This file is too large. The limit is 10MB per import.');
      return;
    }

    setUploading(true);
    try {
      const { batchId } = await uploadImportFile(file);
      onUploaded(batchId);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not upload this file. Please try again.'));
    } finally {
      setUploading(false);
    }
  }, [onUploaded]);

  async function handleTemplateDownload() {
    setTemplateDownloading(true);
    try {
      await downloadImportTemplate();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not download the template.'));
    } finally {
      setTemplateDownloading(false);
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: EASE }}>
      <div
        className="card"
        style={{
          borderStyle: 'dashed',
          borderWidth: 2,
          borderColor: dragging ? 'var(--blue)' : 'var(--border, #d9dee8)',
          background: dragging ? 'rgba(0, 85, 251, 0.04)' : undefined,
          textAlign: 'center',
          padding: '3rem 1.5rem',
          cursor: uploading ? 'default' : 'pointer',
          transition: 'border-color 0.15s ease, background 0.15s ease',
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!uploading) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (uploading) return;
          const file = e.dataTransfer.files?.[0];
          if (file) handleFile(file);
        }}
        onClick={() => !uploading && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Upload student file"
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !uploading) inputRef.current?.click();
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS.join(',')}
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = '';
          }}
        />

        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 16,
            background: 'radial-gradient(circle, rgba(0, 85, 251, 0.12), transparent 70%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem',
          }}
        >
          {uploading ? (
            <Loader2 size={30} color="var(--blue)" strokeWidth={1.75} className="onboarding-spin" />
          ) : (
            <UploadIcon size={30} color="var(--blue)" strokeWidth={1.75} />
          )}
        </div>

        <h3 style={{ margin: '0 0 0.35rem' }}>
          {uploading ? 'Uploading…' : 'Drag a file here, or click to browse'}
        </h3>
        <p style={{ margin: 0, color: 'var(--muted-2)', fontSize: '0.9rem' }}>
          Excel, CSV, Word, or PDF — up to 10MB, 1,000 students per file
        </p>
      </div>

      {error && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{ color: 'var(--danger)', fontSize: '0.9rem', marginTop: '0.75rem' }}
          role="alert"
        >
          {error}
        </motion.p>
      )}

      <div
        className="card"
        style={{ marginTop: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.9rem', flexWrap: 'wrap' }}
      >
        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(201, 151, 74, 0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <FileSpreadsheet size={20} color="var(--gold)" strokeWidth={1.75} />
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>Not sure how to format your file?</div>
          <div style={{ color: 'var(--muted-2)', fontSize: '0.85rem' }}>
            Download our template with the right columns already set up. If you&rsquo;re using Word or PDF, make sure your student list is a table with the same headers.
          </div>
        </div>
        <button type="button" className="btn btn-outline" onClick={handleTemplateDownload} disabled={templateDownloading}>
          <Download size={15} /> {templateDownloading ? 'Downloading…' : 'Download Template'}
        </button>
      </div>
    </motion.div>
  );
}
