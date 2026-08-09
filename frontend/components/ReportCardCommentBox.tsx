'use client';

import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Sparkles } from 'lucide-react';
import { api, ApiError } from '../lib/api';

export function ReportCardCommentBox({
  examId,
  studentId,
  initialComment,
}: {
  examId: string;
  studentId: string;
  initialComment: string | null;
}) {
  const [comment, setComment] = useState(initialComment || '');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    setComment(initialComment || '');
    setSavedMessage(null);
  }, [examId, studentId, initialComment]);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    setSavedMessage(null);
    try {
      const result = await api.post<{ draft: string }>('/api/ai/report-card-comment/draft', {
        examId, studentId,
      });
      setComment(result.draft);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to generate a draft.');
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave() {
    if (!comment.trim()) {
      setError('Comment cannot be empty.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.put('/api/ai/report-card-comment', { examId, studentId, comment });
      setSavedMessage('Comment saved.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card" style={{ marginTop: '1rem' }}>
      <div className="topbar" style={{ marginBottom: '0.6rem' }}>
        <h2 style={{ fontSize: '1rem', margin: 0 }}>Report card comment</h2>
        <button className="btn btn-outline" onClick={handleGenerate} disabled={generating}>
          {generating ? <span className="login-spinner" aria-hidden="true" /> : <Sparkles size={14} />}
          {generating ? 'Generating…' : 'Generate with AI'}
        </button>
      </div>
      <p style={{ color: 'var(--muted)', fontSize: '0.8rem', marginTop: 0 }}>
        AI drafts are a starting point only - read it over and edit before saving. Nothing is
        visible to the parent/student until you save.
      </p>
      <textarea
        rows={4}
        placeholder="Write or generate a comment…"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      {error && <p className="error-text">{error}</p>}
      <AnimatePresence>
        {savedMessage && (
          <motion.p
            className="success-text"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <CheckCircle2 size={14} /> {savedMessage}
          </motion.p>
        )}
      </AnimatePresence>
      <button className="btn" onClick={handleSave} disabled={saving} style={{ marginTop: '0.6rem' }}>
        {saving ? <span className="login-spinner" aria-hidden="true" /> : 'Save comment'}
      </button>
    </div>
  );
}
