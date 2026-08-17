'use client';

import { useState, useEffect, FormEvent } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle2, Mail } from 'lucide-react';
import { api } from '../../lib/api';
import { useTheme } from '../../lib/theme-context';
import { getErrorMessage } from '../../lib/errors';

const EASE = [0.16, 1, 0.3, 1] as const;

export default function ForgotPasswordPage() {
  const { theme, setTheme } = useTheme();

  // Same light-mode-only convention as the login screen this leads from.
  useEffect(() => {
    if (theme !== 'light') setTheme('light');
  }, [theme, setTheme]);

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post('/api/auth/forgot-password', { email });
      // Same response either way (see backend) - the UI reflects that by
      // always showing the confirmation screen, never "no account found".
      setSent(true);
    } catch (err) {
      setError(getErrorMessage(err, 'Something went wrong.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-ambient" aria-hidden="true" />

      <motion.div
        className="card login-card"
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: EASE }}
      >
        <div className="login-brand-block">
          <div className="login-logo-wrap">
            <div className="login-logo-glow" />
            <img src="/images/logo.png" alt="Nuruddeen Schools" className="login-logo-img" />
          </div>
          <div className="login-brand-name">
            Nuruddeen&nbsp;<span className="accent">Schools</span>
          </div>
          <div className="login-brand-loc">Gusau &middot; Zamfara State</div>
          <div className="login-brand-divider" />
        </div>

        {sent ? (
          <>
            <div className="login-card-eyebrow-wrap">
              <span className="login-card-eyebrow">Check your inbox</span>
            </div>
            <h2>Code on its way</h2>
            <p className="login-sub">
              If an account exists for <strong>{email}</strong>, we&apos;ve sent a one-time login code to it (a
              guardian&apos;s email/phone, for a student account). Enter it as your password on the sign-in
              screen to continue.
            </p>
            <div
              className="card"
              style={{ borderColor: 'var(--success)', borderLeft: '3px solid var(--success)', marginTop: 8, padding: '0.9rem 1rem' }}
            >
              <strong style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}>
                <CheckCircle2 size={16} color="var(--success)" /> Request received
              </strong>
              <p style={{ fontSize: '0.8rem', color: 'var(--muted)', margin: '0.4rem 0 0' }}>
                Didn&apos;t get anything after a few minutes? Double-check the email on file with the school,
                or contact the office directly.
              </p>
            </div>
            <Link href="/login" className="btn login-submit" style={{ marginTop: 20, textDecoration: 'none' }}>
              <ArrowLeft size={15} />
              Back to sign in
            </Link>
          </>
        ) : (
          <>
            <div className="login-card-eyebrow-wrap">
              <span className="login-card-eyebrow">Account Recovery</span>
            </div>
            <h2>Reset your password</h2>
            <p className="login-sub">Enter the email on your portal account and we&apos;ll send a one-time login code.</p>

            <form onSubmit={handleSubmit}>
              <div className="field">
                <label htmlFor="email">Email address</label>
                <div className="input-shell">
                  <Mail size={16} />
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="username"
                    placeholder="you@nuruddeenschools.edu.ng"
                  />
                </div>
              </div>

              {error && <p className="error-text">{error}</p>}

              <button className="btn login-submit" type="submit" disabled={submitting}>
                {submitting ? <span className="login-spinner" aria-hidden="true" /> : 'Send login code'}
              </button>
            </form>

            <p className="login-footnote">
              <Link href="/login" style={{ color: 'var(--blue)', fontWeight: 600, textDecoration: 'none' }}>
                ← Back to sign in
              </Link>
            </p>
          </>
        )}
      </motion.div>
    </div>
  );
}
