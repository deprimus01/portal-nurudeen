'use client';

import { useState, FormEvent } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { ApiError } from '../../lib/api';
import { useLanguage } from '../../lib/i18n/language-context';
import { ThemeToggle } from '../../components/ui/ThemeToggle';
import { LanguageSwitcher } from '../../components/ui/LanguageSwitcher';

const EASE = [0.16, 1, 0.3, 1] as const;

export default function LoginPage() {
  const { login } = useAuth();
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
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
      <div className="login-left">
        <div className="login-orb login-orb-1" />
        <div className="login-orb login-orb-2" />

        <motion.div
          className="login-brand"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
        >
          <img src="/images/logo.png" alt="Nuruddeen Schools" className="shell-brand-mark" />
          <div className="login-brand-text">
            Nuruddeen Schools
            <span>Gusau, Zamfara State</span>
          </div>
        </motion.div>

        <motion.div
          className="login-headline"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.1, ease: EASE }}
        >
          <h1>{t('login.headline')}</h1>
          <p>
            {t('login.subheadline')}
          </p>
        </motion.div>

        <motion.div
          className="login-seal-row"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.2, ease: EASE }}
        >
          <div className="login-seal">
            <span className="num mono">4</span>
            <span className="lbl">{t('login.portalsInOneSystem')}</span>
          </div>
          <div className="login-seal">
            <span className="num mono">24/7</span>
            <span className="lbl">{t('login.accessAnywhere')}</span>
          </div>
        </motion.div>
      </div>

      <div className="login-mobile-header">
        <img src="/images/logo.png" alt="Nuruddeen Schools" className="shell-brand-mark" />
        <div className="login-brand-text">
          Nuruddeen Schools
          <span>Gusau, Zamfara State</span>
        </div>
      </div>

      <div className="login-right">
        <motion.div
          className="card login-card"
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: EASE }}
        >
          <div className="login-top-logo">
            <img
              src="/images/logo.png"
              alt="Nuruddeen Schools"
              className="shell-brand-mark"
              style={{ width: 34, height: 34, objectFit: 'contain' }}
            />
            <span>Nuruddeen Schools</span>
            <div className="login-theme-toggle">
              <LanguageSwitcher compact />
              <ThemeToggle compact />
            </div>
          </div>
          <h2>{t('login.welcomeBack')}</h2>
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
              <label className="login-remember">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                {t('login.rememberMe')}
              </label>
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

          <div className="login-role-row">
            <span className="badge">Admin</span>
            <span className="badge">Teacher</span>
            <span className="badge">Student</span>
            <span className="badge">Guardian</span>
          </div>

          <p className="login-footnote">
            {t('login.noAccount')} {t('login.inviteOnlyNotice')}
          </p>
        </motion.div>
      </div>
    </div>
  );
}
