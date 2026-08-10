'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarClock, Layers, X } from 'lucide-react';
import { api, ApiError } from '../../../lib/api';
import type { SchoolClass, Subject, Staff, TimetableSlot } from '../../../lib/types';
import { DAYS, PERIODS, slotKey, TimetableGrid } from '../../../components/ui/TimetableGrid';
import { EmptyState } from '../../../components/ui/EmptyState';
import { useLanguage } from '../../../lib/i18n/language-context';

const EASE = [0.16, 1, 0.3, 1] as const;

export default function AdminTimetablePage() {
  const { t } = useLanguage();
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [classId, setClassId] = useState('');
  const [slots, setSlots] = useState<Map<string, TimetableSlot>>(new Map());
  const [loading, setLoading] = useState(true);
  const [editingCell, setEditingCell] = useState<{ day: string; period: number } | null>(null);
  const [cellForm, setCellForm] = useState<{ mode: 'lesson' | 'label'; subjectId: string; staffId: string; label: string }>({
    mode: 'lesson', subjectId: '', staffId: '', label: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<SchoolClass[]>('/api/classes'),
      api.get<Subject[]>('/api/subjects'),
      api.get<Staff[]>('/api/staff'),
    ]).then(([c, s, st]) => {
      setClasses(c);
      setSubjects(s);
      setStaff(st);
      if (c.length > 0) setClassId(c[0].id);
    }).finally(() => setLoading(false));
  }, []);

  async function loadSlots(id: string) {
    if (!id) return;
    setLoading(true);
    try {
      const data = await api.get<TimetableSlot[]>(`/api/timetable/class/${id}`);
      const map = new Map<string, TimetableSlot>();
      data.forEach((s) => map.set(slotKey(s.dayOfWeek, s.period), s));
      setSlots(map);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load timetable.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (classId) loadSlots(classId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  function openCell(day: string, period: number) {
    const existing = slots.get(slotKey(day, period));
    setCellForm({
      mode: existing?.label ? 'label' : 'lesson',
      subjectId: existing?.subjectId || '',
      staffId: existing?.staffId || '',
      label: existing?.label || '',
    });
    setEditingCell({ day, period });
    setError(null);
  }

  async function saveCell() {
    if (!editingCell) return;
    setSaving(true);
    setError(null);
    try {
      const body: any = { classId, dayOfWeek: editingCell.day, period: editingCell.period };
      if (cellForm.mode === 'label') {
        body.label = cellForm.label;
      } else {
        body.subjectId = cellForm.subjectId;
        body.staffId = cellForm.staffId;
      }
      const slot = await api.put<TimetableSlot>('/api/timetable/slot', body);
      setSlots((m) => new Map(m).set(slotKey(editingCell.day, editingCell.period), slot));
      setEditingCell(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save.');
    } finally {
      setSaving(false);
    }
  }

  async function clearCell() {
    if (!editingCell) return;
    setSaving(true);
    setError(null);
    try {
      await api.delete('/api/timetable/slot', {
        classId, dayOfWeek: editingCell.day, period: editingCell.period,
      } as any);
      setSlots((m) => {
        const next = new Map(m);
        next.delete(slotKey(editingCell.day, editingCell.period));
        return next;
      });
      setEditingCell(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to clear.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 className="page-title" style={{ marginBottom: 4 }}>{t('pages.timetable.title')}</h1>
          <p className="page-sub" style={{ margin: 0 }}>
            Click any cell to assign a subject + teacher, or label it (e.g. &ldquo;Assembly&rdquo;, &ldquo;Break&rdquo;).
          </p>
        </div>
        {classes.length > 0 && (
          <select value={classId} onChange={(e) => setClassId(e.target.value)} style={{ maxWidth: '220px' }}>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
      </div>

      {!loading && classes.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={CalendarClock}
            title="No classes to schedule yet"
            description="Create a class before building its timetable."
            tone="navy"
            action={
              <Link href="/admin/classes" className="btn">
                <Layers size={15} /> Go to Classes
              </Link>
            }
          />
        </div>
      ) : (
      <>
      <AnimatePresence>
        {editingCell && (
          <motion.div
            className="card"
            style={{ marginBottom: '1.5rem' }}
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: 'auto', marginBottom: '1.5rem' }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <strong>{editingCell.day} - Period {editingCell.period}</strong>
              <button className="btn-ghost btn" style={{ padding: 4 }} onClick={() => setEditingCell(null)} aria-label="Close">
                <X size={16} />
              </button>
            </div>
            <div style={{ display: 'flex', gap: '1rem', margin: '0.8rem 0', fontSize: '0.85rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', margin: 0 }}>
                <input type="radio" checked={cellForm.mode === 'lesson'} onChange={() => setCellForm({ ...cellForm, mode: 'lesson' })} />
                Subject + Teacher
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', margin: 0 }}>
                <input type="radio" checked={cellForm.mode === 'label'} onChange={() => setCellForm({ ...cellForm, mode: 'label' })} />
                Label (Assembly, Break, etc.)
              </label>
            </div>

            {cellForm.mode === 'lesson' ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                <select value={cellForm.subjectId} onChange={(e) => setCellForm({ ...cellForm, subjectId: e.target.value })}>
                  <option value="" disabled>Subject…</option>
                  {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <select value={cellForm.staffId} onChange={(e) => setCellForm({ ...cellForm, staffId: e.target.value })}>
                  <option value="" disabled>Teacher…</option>
                  {staff.map((s) => <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>)}
                </select>
              </div>
            ) : (
              <input placeholder="e.g. Assembly" value={cellForm.label} onChange={(e) => setCellForm({ ...cellForm, label: e.target.value })} />
            )}

            {error && <p className="error-text">{error}</p>}
            <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1rem' }}>
              <button className="btn" onClick={saveCell} disabled={saving}>
                {saving ? <span className="login-spinner" aria-hidden="true" /> : 'Save'}
              </button>
              <button className="btn btn-outline" onClick={clearCell} disabled={saving}>Clear cell</button>
              <button className="btn btn-outline" onClick={() => setEditingCell(null)}>Cancel</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <TimetableGrid
        slots={slots}
        loading={loading}
        emptyMessage="No timetable set for this class yet."
        subLabel={(slot) => (slot.staff ? `${slot.staff.firstName} ${slot.staff.lastName}` : undefined)}
        onCellClick={openCell}
      />
      </>
      )}
    </div>
  );
}
