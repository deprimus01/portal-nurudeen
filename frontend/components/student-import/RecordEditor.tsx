'use client';

import { useState } from 'react';
import { AlertCircle, AlertTriangle, Loader2, Save, X } from 'lucide-react';
import type { ImportRecord } from '../../lib/types';
import type { ImportRecordCorrection } from '../../lib/studentImportApi';
import type { SchoolClass, Guardian } from '../../lib/types';

const RELATIONSHIP_OPTIONS = ['FATHER', 'MOTHER', 'GUARDIAN', 'OTHER'];

interface RecordEditorProps {
  record: ImportRecord;
  classes: SchoolClass[];
  guardianOptions: Guardian[];
  onSave: (correction: ImportRecordCorrection) => Promise<void>;
  onCancel: () => void;
}

export function RecordEditor({ record, classes, guardianOptions, onSave, onCancel }: RecordEditorProps) {
  const m = record.mappedData;
  const [form, setForm] = useState({
    firstName: m.firstName || '',
    lastName: m.lastName || '',
    otherNames: m.otherNames || '',
    admissionNumber: m.admissionNumber || '',
    gender: m.gender || '',
    classId: m.matchedClassId || '',
    guardianMode: m.matchedGuardianId ? 'existing' : 'new',
    guardianId: m.matchedGuardianId || '',
    guardianFirstName: m.guardianFirstName || '',
    guardianLastName: m.guardianLastName || '',
    guardianPhone: m.guardianPhone || '',
    guardianEmail: m.guardianEmail || '',
    guardianRelationship: m.guardianRelationship || 'GUARDIAN',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const correction: ImportRecordCorrection = {
        firstName: form.firstName,
        lastName: form.lastName,
        otherNames: form.otherNames,
        admissionNumber: form.admissionNumber,
        gender: (form.gender || undefined) as 'MALE' | 'FEMALE' | undefined,
        guardianRelationship: form.guardianRelationship as 'FATHER' | 'MOTHER' | 'GUARDIAN' | 'OTHER',
      };
      if (form.classId) correction.classId = form.classId;

      if (form.guardianMode === 'existing') {
        correction.guardianId = form.guardianId || null;
      } else {
        correction.guardianId = null;
        correction.guardianFirstName = form.guardianFirstName;
        correction.guardianLastName = form.guardianLastName;
        correction.guardianPhone = form.guardianPhone;
        correction.guardianEmail = form.guardianEmail;
      }

      await onSave(correction);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this correction.');
      setSaving(false);
    }
  }

  return (
    <div className="card" style={{ background: 'var(--surface-2)', boxShadow: 'none', marginTop: '0.75rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.7rem' }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>First name</label>
          <input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Last name</label>
          <input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Other names</label>
          <input value={form.otherNames} onChange={(e) => setForm({ ...form, otherNames: e.target.value })} />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Gender</label>
          <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
            <option value="" disabled>Select…</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Class</label>
          <select value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })}>
            <option value="" disabled>Select…</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Serial number</label>
          <input value={form.admissionNumber} onChange={(e) => setForm({ ...form, admissionNumber: e.target.value })} placeholder="e.g. 1, 2, 3…" />
          <p style={{ fontSize: '0.78rem', color: 'var(--muted-2)', margin: '0.3rem 0 0' }}>
            Numbered within the selected class — reused across other classes is fine.
          </p>
        </div>
      </div>

      <h4 style={{ fontSize: '0.85rem', margin: '1rem 0 0.5rem' }}>
        Guardian <span style={{ fontWeight: 400, color: 'var(--muted-2)' }}>(optional)</span>
      </h4>
      <div style={{ display: 'flex', gap: '0.8rem', marginBottom: '0.6rem', fontSize: '0.85rem' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', margin: 0 }}>
          <input type="radio" checked={form.guardianMode === 'existing'} onChange={() => setForm({ ...form, guardianMode: 'existing' })} />
          Existing guardian
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', margin: 0 }}>
          <input type="radio" checked={form.guardianMode === 'new'} onChange={() => setForm({ ...form, guardianMode: 'new' })} />
          New guardian
        </label>
      </div>

      {form.guardianMode === 'existing' ? (
        <select value={form.guardianId} onChange={(e) => setForm({ ...form, guardianId: e.target.value })}>
          <option value="">No guardian for now</option>
          {guardianOptions.map((g) => (
            <option key={g.id} value={g.id}>{g.firstName} {g.lastName} — {g.phone}</option>
          ))}
        </select>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.6rem' }}>
          <input placeholder="First name" value={form.guardianFirstName} onChange={(e) => setForm({ ...form, guardianFirstName: e.target.value })} />
          <input placeholder="Last name" value={form.guardianLastName} onChange={(e) => setForm({ ...form, guardianLastName: e.target.value })} />
          <input placeholder="Phone" value={form.guardianPhone} onChange={(e) => setForm({ ...form, guardianPhone: e.target.value })} />
          <input placeholder="Email (optional)" type="email" value={form.guardianEmail} onChange={(e) => setForm({ ...form, guardianEmail: e.target.value })} />
        </div>
      )}

      <div style={{ marginTop: '0.6rem' }}>
        <select
          value={form.guardianRelationship}
          onChange={(e) => setForm({ ...form, guardianRelationship: e.target.value as typeof form.guardianRelationship })}
          style={{ width: 'auto' }}
        >
          {RELATIONSHIP_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {error && (
        <p style={{ color: 'var(--danger)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 5, marginTop: '0.75rem' }}>
          <AlertCircle size={14} /> {error}
        </p>
      )}

      <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-outline" onClick={onCancel} disabled={saving}>
          <X size={15} /> Cancel
        </button>
        <button type="button" className="btn" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 size={15} className="onboarding-spin" /> : <Save size={15} />}
          {saving ? 'Saving…' : 'Save Correction'}
        </button>
      </div>
    </div>
  );
}

// Re-exported so PreviewStep can render issue lists with a consistent icon.
export function IssueIcon({ severity }: { severity: 'error' | 'warning' }) {
  return severity === 'error'
    ? <AlertCircle size={13} color="var(--danger)" style={{ flexShrink: 0 }} />
    : <AlertTriangle size={13} color="var(--warn)" style={{ flexShrink: 0 }} />;
}
