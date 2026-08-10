'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCheck, CheckCircle2, CloudOff, RefreshCw } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { queuePendingAttendance, listPendingAttendance } from '../lib/db';
import { flushPendingAttendance } from '../lib/attendanceSync';
import { useOnlineStatus } from '../lib/useOnlineStatus';
import { EmptyState } from './ui/EmptyState';

type Status = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';

interface RosterEntry {
  studentId: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  status: Status | null;
}

const STATUS_OPTIONS: { value: Status; label: string; badgeClass: string }[] = [
  { value: 'PRESENT', label: 'Present', badgeClass: 'badge-success' },
  { value: 'ABSENT', label: 'Absent', badgeClass: 'badge-danger' },
  { value: 'LATE', label: 'Late', badgeClass: 'badge-warn' },
  { value: 'EXCUSED', label: 'Excused', badgeClass: 'badge-gold' },
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function initialsFor(first: string, last: string) {
  return `${first?.[0] || ''}${last?.[0] || ''}`.toUpperCase() || '?';
}

export function AttendanceEntry({
  classOptions,
}: {
  classOptions: { id: string; name: string }[];
}) {
  const [classId, setClassId] = useState(classOptions[0]?.id || '');
  const [date, setDate] = useState(todayISO());
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const online = useOnlineStatus();

  async function refreshPendingCount() {
    const queued = await listPendingAttendance();
    setPendingCount(queued.length);
  }

  // Try to sync any queued offline submissions as soon as we're back
  // online, and once on mount in case some were queued in a previous
  // session that never got the chance to sync.
  useEffect(() => {
    refreshPendingCount();
  }, []);

  useEffect(() => {
    if (!online) return;
    flushPendingAttendance().then((result) => {
      if (result.synced > 0) {
        setSavedMessage(`Synced ${result.synced} offline attendance ${result.synced === 1 ? 'entry' : 'entries'}.`);
      }
      refreshPendingCount();
    });
  }, [online]);

  async function loadRoster() {
    if (!classId || !date) return;
    setLoading(true);
    setError(null);
    setSavedMessage(null);
    try {
      const res = await api.getWithCache<{ roster: RosterEntry[] }>(
        `/api/attendance/roster?classId=${classId}&date=${date}`,
      );
      setRoster(res.data.roster);
      setFromCache(res.fromCache);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load roster.');
      setRoster([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRoster();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, date]);

  function setStatus(studentId: string, status: Status) {
    setRoster((r) => r.map((row) => (row.studentId === studentId ? { ...row, status } : row)));
  }

  function markAllPresent() {
    setRoster((r) => r.map((row) => ({ ...row, status: 'PRESENT' as Status })));
  }

  async function handleSave() {
    const unmarked = roster.filter((r) => !r.status);
    if (unmarked.length > 0) {
      setError(`${unmarked.length} student(s) still unmarked. Mark everyone before saving.`);
      return;
    }

    const payload = {
      classId,
      date,
      records: roster.map((r) => ({ studentId: r.studentId, status: r.status as string })),
    };

    setSaving(true);
    setError(null);
    setSavedMessage(null);
    try {
      await api.post('/api/attendance', payload);
      setSavedMessage('Attendance saved.');
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 850);
    } catch (err) {
      // A network failure (device genuinely offline) - queue it instead
      // of losing a completed roster the teacher just filled in by hand.
      // A real API error (validation, permission, etc.) is shown as an
      // error instead, since queuing something that will never succeed
      // just delays the teacher finding out.
      if (err instanceof TypeError) {
        await queuePendingAttendance(payload);
        await refreshPendingCount();
        setSavedMessage('No connection - saved on this device. Will sync automatically once you\u2019re back online.');
      } else {
        setError(err instanceof ApiError ? err.message : 'Failed to save attendance.');
      }
    } finally {
      setSaving(false);
    }
  }

  const markedCount = roster.filter((r) => r.status).length;

  return (
    <div>
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="field" style={{ marginBottom: 0, minWidth: '180px' }}>
            <label htmlFor="attClass">Class</label>
            <select id="attClass" value={classId} onChange={(e) => setClassId(e.target.value)}>
              {classOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="attDate">Date</label>
            <input id="attDate" type="date" value={date} onChange={(e) => setDate(e.target.value)} max={todayISO()} />
          </div>
          {roster.length > 0 && (
            <button type="button" className="btn btn-outline" onClick={markAllPresent}>
              <CheckCheck size={15} /> Mark all present
            </button>
          )}
          {roster.length > 0 && (
            <span className="filter-chip active" style={{ marginLeft: 'auto' }}>
              {markedCount}/{roster.length} marked
            </span>
          )}
        </div>
      </div>

      {error && <p className="error-text" style={{ marginBottom: '1rem' }}>{error}</p>}
      {fromCache && (
        <p style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--warn, #C9971C)', fontSize: '0.85rem', marginBottom: '1rem' }}>
          <CloudOff size={14} /> Offline - showing the last roster saved on this device.
        </p>
      )}
      {pendingCount > 0 && (
        <p style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
          <RefreshCw size={14} />
          {pendingCount} attendance {pendingCount === 1 ? 'entry' : 'entries'} saved offline, waiting to sync{online ? '…' : ' (reconnect to sync).'}
        </p>
      )}
      <AnimatePresence>
        {savedMessage && (
          <motion.p
            className="success-text"
            style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 6 }}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <CheckCircle2 size={15} /> {savedMessage}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="table-wrap">
        {loading ? (
          <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 18, width: `${88 - i * 6}%` }} />
            ))}
          </div>
        ) : roster.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="No students to mark"
            description="No active enrollments found for this class in the current term."
          />
        ) : (
          <>
            <table>
              <thead>
                <tr><th>Student</th><th>Admission #</th><th>Status</th></tr>
              </thead>
              <tbody>
                {roster.map((row) => (
                  <tr key={row.studentId}>
                    <td className="name-cell">
                      <div className="shell-avatar" style={{ width: 30, height: 30, fontSize: 11 }}>
                        {initialsFor(row.firstName, row.lastName)}
                      </div>
                      <span style={{ fontWeight: 600 }}>{row.firstName} {row.lastName}</span>
                    </td>
                    <td className="mono" style={{ color: 'var(--muted)' }}>{row.admissionNumber}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        {STATUS_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            className={`badge badge-btn ${row.status === opt.value ? opt.badgeClass : ''}`}
                            style={{
                              border: '1px solid var(--border)',
                              cursor: 'pointer',
                              opacity: row.status && row.status !== opt.value ? 0.5 : 1,
                              transition: 'all 0.15s var(--ease)',
                            }}
                            onClick={() => setStatus(row.studentId, opt.value)}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ padding: '1rem 1.25rem' }}>
              <button
                className={`btn${justSaved ? ' btn-flash-success' : ''}`}
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <span className="login-spinner" aria-hidden="true" />
                ) : justSaved ? (
                  <>
                    <CheckCircle2 size={15} /> Saved
                  </>
                ) : (
                  'Save attendance'
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
