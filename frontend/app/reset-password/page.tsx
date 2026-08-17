'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { KeyRound, Lock, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { api } from '../../lib/api';
import { ThemeToggle } from '../../components/ui/ThemeToggle';
import { RouteLoader } from '../../components/ui/RouteLoader';
import { getErrorMessage } from '../../lib/errors';

const EASE = [0.16, 1, 0.3, 1] as const;

export default function ResetPasswordPage() {
  const { user, loading, refresh } = useAuth();
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/api/auth/reset-password', { currentPassword, newPassword });
      await refresh();
      router.push('/admin');
    } catch (err) {
      setError(getErrorMessage(err, 'Something went wrong.'));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !user) return <RouteLoader />;

  return (
    <div className="auth-shell">
      <div style={{ position: 'absolute', top: 20, right: 20, zIndex: 2 }}>
        <ThemeToggle />
      </div>
      <motion.div
        className="card auth-card login-card"
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: EASE }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <div
            className="shell-brand-mark"
            style={{ width: 34, height: 34, fontSize: 13, background: 'rgba(0,85,251,0.12)', color: 'var(--blue)' }}
          >
            <ShieldCheck size={16} />
          </div>
          <span style={{ fontWeight: 700, fontFamily: "'Lexend', sans-serif", fontSize: '14.5px' }}>Security check</span>
        </div>
        <h2 style={{ fontSize: 22, marginBottom: 6 }}>Set a new password</h2>
        <p className="login-sub">This is your first login - please set a permanent password before continuing.</p>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="currentPassword">One-time login code</label>
            <div className="input-shell">
              <KeyRound size={16} />
              <input
                id="currentPassword"
                type="password"
                required
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="one-time-code"
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="newPassword">New password (min. 8 characters)</label>
            <div className="input-shell">
              <Lock size={16} />
              <input
                id="newPassword"
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="confirmPassword">Confirm new password</label>
            <div className="input-shell">
              <Lock size={16} />
              <input
                id="confirmPassword"
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
          </div>
          {error && <p className="error-text">{error}</p>}
          <button className="btn login-submit" type="submit" disabled={submitting}>
            {submitting ? <span className="login-spinner" aria-hidden="true" /> : 'Set password & continue'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
