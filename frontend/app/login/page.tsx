'use client';

import { useState, useEffect, FormEvent } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Lock, Mail, ShieldCheck, BookOpen, GraduationCap, Users } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { ApiError } from '../../lib/api';
import { useLanguage } from '../../lib/i18n/language-context';
import { useTheme } from '../../lib/theme-context';
import { LanguageSwitcher } from '../../components/ui/LanguageSwitcher';

const EASE = [0.16, 1, 0.3, 1] as const;

export default function LoginPage() {
  const { login } = useAuth();
  const { t } = useLanguage();
  const { theme, setTheme } = useTheme();

  // Login screen is light-mode only, regardless of the visitor's stored
  // theme preference (no dark-mode toggle is shown here).
  useEffect(() => {
    if (theme !== 'light') setTheme('light');
  }, [theme, setTheme]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
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
        <div className="login-card-controls">
          <LanguageSwitcher compact />
        </div>

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

        <div className="login-card-eyebrow-wrap">
          <span className="login-card-eyebrow">Secure Sign In</span>
        </div>
        <h2>{t('login.welcomeBack')}.</h2>
        <p className="login-sub">{t('login.signInSubtitle')}</p>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="email">{t('login.emailAddress')}</label>
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

          <div className="field">
            <label htmlFor="password">{t('login.password')}</label>
            <div className="input-shell">
              <Lock size={16} />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
                style={{ paddingRight: 40 }}
              />
              <button
                type="button"
                className="input-eye-toggle"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="login-row-between">
            <span className="login-forgot" title="Contact the school office to reset your password">
              {t('login.forgotPassword')}
            </span>
          </div>

          {error && <p className="error-text">{error}</p>}

          <button className="btn login-submit" type="submit" disabled={submitting}>
            {submitting ? (
              <span className="login-spinner" aria-hidden="true" />
            ) : (
              <>
                {t('login.signIn')}
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </>
            )}
          </button>
        </form>

        <div className="login-roles-divider">One portal, four experiences</div>
        <div className="login-role-grid">
          <span className="role-pill">
            <ShieldCheck size={14} />
            Admin
          </span>
          <span className="role-pill">
            <BookOpen size={14} />
            Teacher
          </span>
          <span className="role-pill">
            <GraduationCap size={14} />
            Student
          </span>
          <span className="role-pill">
            <Users size={14} />
            Guardian
          </span>
        </div>

        <p className="login-footnote">
          {t('login.noAccount')} {t('login.inviteOnlyNotice')}
        </p>
      </motion.div>
    </div>
  );
}
