'use client';

import { useState, FormEvent } from 'react';
import { KeyRound, Lock, Mail, Phone, ShieldCheck, User } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { useLanguage } from '../../lib/i18n/language-context';
import { api, ApiError } from '../../lib/api';
import { ThemeToggle } from './ThemeToggle';
import { LanguageSwitcher } from './LanguageSwitcher';

interface LinkedStudent {
  relationship: string;
  isPrimary: boolean;
  student: {
    firstName: string;
    lastName: string;
    admissionNumber?: string;
    currentClass?: { name: string } | null;
  };
}

interface SettingsProfile {
  firstName?: string;
  lastName?: string;
  phone?: string;
  employeeId?: string;
  admissionNumber?: string;
  currentClass?: { name: string } | null;
  studentGuardians?: LinkedStudent[];
}

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function SettingsView({ roleLabel }: { roleLabel: string }) {
  const { user } = useAuth();
  const { t } = useLanguage();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!user) return null;

  const profile = user.profile as SettingsProfile | null;
  const displayName = profile?.firstName ? `${profile.firstName} ${profile.lastName ?? ''}`.trim() : user.email;
  const initials = initialsFor(displayName);

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/api/auth/reset-password', { currentPassword, newPassword });
      setSuccess('Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1 className="page-title">{t('common.settings')}</h1>
      <p className="page-sub">Manage your profile, preferences and account security.</p>

      {/* Profile */}
      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-head">
          <h3>Profile</h3>
        </div>

        <div className="settings-profile-row">
          <div className="shell-avatar settings-avatar">{initials}</div>
          <div>
            <div className="settings-profile-name">{displayName}</div>
            <div className="settings-profile-role">{roleLabel}</div>
          </div>
        </div>

        <div className="settings-detail-grid">
          <div className="settings-detail">
            <span className="settings-detail-label">
              <Mail size={13} /> Email
            </span>
            <span className="settings-detail-value">{user.email}</span>
          </div>
          {profile?.phone && (
            <div className="settings-detail">
              <span className="settings-detail-label">
                <Phone size={13} /> Phone
              </span>
              <span className="settings-detail-value">{profile.phone}</span>
            </div>
          )}
          {profile?.employeeId && (
            <div className="settings-detail">
              <span className="settings-detail-label">
                <User size={13} /> Employee ID
              </span>
              <span className="settings-detail-value">{profile.employeeId}</span>
            </div>
          )}
          {profile?.admissionNumber && (
            <div className="settings-detail">
              <span className="settings-detail-label">
                <User size={13} /> Admission No.
              </span>
              <span className="settings-detail-value">{profile.admissionNumber}</span>
            </div>
          )}
          {profile?.currentClass?.name && (
            <div className="settings-detail">
              <span className="settings-detail-label">
                <User size={13} /> Class
              </span>
              <span className="settings-detail-value">{profile.currentClass.name}</span>
            </div>
          )}
        </div>

        {profile?.studentGuardians && profile.studentGuardians.length > 0 && (
          <div className="settings-children">
            <div className="settings-detail-label" style={{ marginBottom: 8 }}>
              Linked students
            </div>
            {profile.studentGuardians.map((sg, i) => (
              <div className="today-item" key={i}>
                <div className="today-icon" style={{ background: 'rgba(0,85,251,0.12)', color: 'var(--blue)' }}>
                  <User size={16} />
                </div>
                <div className="ti-text">
                  <div className="ti-title">
                    {sg.student.firstName} {sg.student.lastName}
                  </div>
                  <div className="ti-sub">
                    {sg.relationship}
                    {sg.isPrimary ? ' · Primary guardian' : ''} · {sg.student.currentClass?.name || 'Not assigned yet'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preferences */}
      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-head">
          <h3>Preferences</h3>
        </div>
        <div className="settings-pref-row">
          <div>
            <div className="settings-pref-label">Appearance</div>
            <div className="settings-pref-sub">Switch between light and dark mode.</div>
          </div>
          <ThemeToggle />
        </div>
        <div className="settings-pref-row">
          <div>
            <div className="settings-pref-label">Language</div>
            <div className="settings-pref-sub">Choose your preferred display language.</div>
          </div>
          <LanguageSwitcher />
        </div>
      </div>

      {/* Security */}
      <div className="panel">
        <div className="panel-head">
          <h3>Security</h3>
        </div>
        <form onSubmit={handleChangePassword} className="settings-password-form">
          <div className="field">
            <label htmlFor="currentPassword">Current password</label>
            <div className="input-shell">
              <KeyRound size={16} />
              <input
                id="currentPassword"
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
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
          {success && <p className="success-text">{success}</p>}
          <button className="btn settings-password-submit" type="submit" disabled={submitting}>
            {submitting ? (
              <span className="login-spinner" aria-hidden="true" />
            ) : (
              <>
                <ShieldCheck size={15} /> Update password
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
