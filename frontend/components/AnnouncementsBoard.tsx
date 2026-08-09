'use client';

import { useEffect, useState, FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Megaphone, Plus, Trash2, X } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import type { Announcement, SchoolClass } from '../lib/types';
import { EmptyState } from './ui/EmptyState';
import { OfflineBanner } from './ui/OfflineBanner';

interface AnnouncementsBoardProps {
  role: 'ADMIN' | 'TEACHER' | 'GUARDIAN' | 'STUDENT';
}

const EASE = [0.16, 1, 0.3, 1] as const;

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function AnnouncementsBoard({ role }: AnnouncementsBoardProps) {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<'SCHOOL_WIDE' | 'CLASS'>(role === 'ADMIN' ? 'SCHOOL_WIDE' : 'CLASS');
  const [classId, setClassId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cachedAt, setCachedAt] = useState<number | undefined>();

  const myStaffId = (user?.profile as { id?: string } | null)?.id;
  const readOnly = role === 'GUARDIAN' || role === 'STUDENT';

  async function load() {
    setLoading(true);
    try {
      const res = await api.getWithCache<Announcement[]>('/api/announcements');
      setAnnouncements(res.data);
      setCachedAt(res.fromCache ? res.cachedAt : undefined);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load announcements.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    if (role === 'ADMIN') {
      api.get<SchoolClass[]>('/api/classes').then(setClasses).catch(() => {});
    } else {
      const staffClasses = (user?.profile as { staffClasses?: { class: SchoolClass }[] } | null)?.staffClasses;
      setClasses((staffClasses || []).map((sc) => sc.class));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, user]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post('/api/announcements', {
        title,
        body,
        audience,
        classId: audience === 'CLASS' ? classId : undefined,
      });
      setTitle('');
      setBody('');
      setClassId('');
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to post announcement.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this announcement?')) return;
    try {
      await api.delete(`/api/announcements/${id}`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to remove announcement.');
    }
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 className="page-title" style={{ marginBottom: 4 }}>Announcements</h1>
          <p className="page-sub" style={{ margin: 0 }}>
            {role === 'ADMIN'
              ? 'School-wide or class-specific notices.'
              : role === 'TEACHER'
              ? 'Post notices to the classes you teach.'
              : role === 'STUDENT'
              ? 'Notices from the school and your class.'
              : "Notices from the school and your child's class."}
          </p>
        </div>
        {!readOnly && (
          <button className="btn" onClick={() => setShowForm((v) => !v)}>
            {showForm ? <X size={15} /> : <Plus size={15} />}
            {showForm ? 'Cancel' : 'New Announcement'}
          </button>
        )}
      </div>

      <AnimatePresence initial={false}>
        {showForm && !readOnly && (
          <motion.form
            onSubmit={handleSubmit}
            className="card"
            style={{ marginBottom: '1.5rem', overflow: 'hidden' }}
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: 'auto', marginBottom: '1.5rem' }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
          >
            <div className="field">
              <label htmlFor="title">Title</label>
              <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={120} />
            </div>

            {role === 'ADMIN' && (
              <div className="field">
                <label htmlFor="audience">Audience</label>
                <select id="audience" value={audience} onChange={(e) => setAudience(e.target.value as 'SCHOOL_WIDE' | 'CLASS')}>
                  <option value="SCHOOL_WIDE">Whole school</option>
                  <option value="CLASS">A specific class</option>
                </select>
              </div>
            )}

            {audience === 'CLASS' && (
              <div className="field">
                <label htmlFor="classId">Class</label>
                <select id="classId" value={classId} onChange={(e) => setClassId(e.target.value)} required>
                  <option value="" disabled>Select a class…</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {classes.length === 0 && (
                  <p style={{ color: 'var(--muted)', fontSize: '0.8rem', marginTop: '0.3rem' }}>
                    You&apos;re not assigned to any classes yet.
                  </p>
                )}
              </div>
            )}

            <div className="field">
              <label htmlFor="body">Message</label>
              <textarea
                id="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
                maxLength={4000}
                rows={4}
                style={{ resize: 'vertical' }}
              />
            </div>

            {error && <p className="error-text">{error}</p>}
            <button className="btn" type="submit" disabled={submitting}>
              {submitting ? <span className="login-spinner" aria-hidden="true" /> : 'Post Announcement'}
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      {!showForm && error && <p className="error-text">{error}</p>}
      {cachedAt !== undefined && <OfflineBanner cachedAt={cachedAt} />}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card">
              <div className="skeleton" style={{ height: 16, width: '40%', marginBottom: 10 }} />
              <div className="skeleton" style={{ height: 12, width: '90%' }} />
            </div>
          ))}
        </div>
      ) : announcements.length === 0 ? (
        <div className="card">
          <EmptyState icon={Megaphone} title="No announcements yet" />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          {announcements.map((a, i) => {
            const canDelete = !readOnly && (role === 'ADMIN' || a.authorStaff?.id === myStaffId);
            const authorName = a.authorStaff ? `${a.authorStaff.firstName} ${a.authorStaff.lastName}` : 'Admin';
            return (
              <motion.div
                className="card announcement-card"
                key={a.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: Math.min(i, 8) * 0.04, ease: EASE }}
              >
                <div style={{ display: 'flex', gap: 12 }}>
                  <div className="shell-avatar" style={{ width: 38, height: 38, fontSize: 13, flexShrink: 0 }}>
                    {initialsFor(authorName)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                      <div>
                        <h3 style={{ margin: '0 0 0.3rem', fontSize: '1.02rem' }}>{a.title}</h3>
                        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginBottom: '0.6rem', flexWrap: 'wrap' }}>
                          <span className={a.audience === 'SCHOOL_WIDE' ? 'badge badge-gold' : 'badge badge-success'}>
                            {a.audience === 'SCHOOL_WIDE' ? 'Whole school' : a.class?.name || 'Class'}
                          </span>
                          <span style={{ color: 'var(--muted)', fontSize: '0.78rem' }}>
                            {authorName}
                            {' · '}
                            {new Date(a.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                      </div>
                      {canDelete && (
                        <button className="btn-outline btn" onClick={() => handleDelete(a.id)} style={{ flexShrink: 0, padding: '0.5rem 0.75rem' }}>
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                    <p style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '0.92rem', color: 'var(--text)' }}>{a.body}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
