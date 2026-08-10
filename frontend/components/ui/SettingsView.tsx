'use client';

import { useState, FormEvent } from 'react';
import { KeyRound, Lock, Mail, MapPin, Pencil, Phone, ShieldCheck, User, X } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { useLanguage } from '../../lib/i18n/language-context';
import { api, ApiError } from '../../lib/api';
import { ThemeToggle } from './ThemeToggle';
import { LanguageSwitcher } from './LanguageSwitcher';
import { Toggle } from './Toggle';

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
  email?: string | null;
  address?: string | null;
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
  const { user, refresh } = useAuth();
  const { t } = useLanguage();

  // --- change password state ---
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);
  const [pwSubmitting, setPwSubmitting] = useState(false);

  // --- contact info edit state ---
  const [editingContact, setEditingContact] = useState(false);
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactAddress, setContactAddress] = useState('');
  const [contactError, setContactError] = useState<string | null>(null);
  const [contactSuccess, setContactSuccess] = useState<string | null>(null);
  const [contactSubmitting, setContactSubmitting] = useState(false);

  // --- notification preferences state ---
  const [prefError, setPrefError] = useState<string | null>(null);
  const [prefSavingKey, setPrefSavingKey] = useState<string | null>(null);

  if (!user) return null;

  const profile = user.profile as SettingsProfile | null;
  const displayName = profile?.firstName ? `${profile.firstName} ${profile.lastName ?? ''}`.trim() : user.email;
  const initials = initialsFor(displayName);

  // Only staff and guardians have editable contact fields on their own
  // record — Student has none, so there's nothing to offer them here.
  const canEditContact = user.role === 'ADMIN' || user.role === 'TEACHER' || user.role === 'GUARDIAN';
  const showAddress = user.role === 'GUARDIAN';

  function startEditingContact() {
    setContactPhone(profile?.phone || '');
    setContactEmail(profile?.email || '');
    setContactAddress(profile?.address || '');
    setContactError(null);
    setContactSuccess(null);
    setEditingContact(true);
  }

  async function handleSaveContact(e: FormEvent) {
    e.preventDefault();
    setContactError(null);
    setContactSuccess(null);
    setContactSubmitting(true);
    try {
      await api.patch('/api/auth/me/contact', {
        phone: contactPhone,
        email: contactEmail || undefined,
        ...(showAddress && { address: contactAddress || undefined }),
      });
      await refresh();
      setContactSuccess('Contact info updated.');
      setEditingContact(false);
    } catch (err) {
      setContactError(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setContactSubmitting(false);
    }
  }

  async function handlePrefToggle(key: keyof NonNullable<typeof user.notificationPreferences>, next: boolean) {
    setPrefError(null);
    setPrefSavingKey(key);
    const apiKey =
      key === 'emailAnnouncements'
        ? 'notifyEmailAnnouncements'
        : key === 'smsAnnouncements'
          ? 'notifySmsAnnouncements'
          : key === 'emailMessages'
            ? 'notifyEmailMessages'
            : 'notifySmsMessages';
    try {
      await api.patch('/api/auth/me/preferences', { [apiKey]: next });
      await refresh();
    } catch (err) {
      setPrefError(err instanceof ApiError ? err.message : 'Could not save that — please try again.');
    } finally {
      setPrefSavingKey(null);
    }
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(null);

    if (newPassword !== confirmPassword) {
      setPwError('New password and confirmation do not match.');
      return;
    }

    setPwSubmitting(true);
    try {
      await api.post('/api/auth/reset-password', { currentPassword, newPassword });
      setPwSuccess('Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPwError(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setPwSubmitting(false);
    }
  }

  const prefs = user.notificationPreferences;

  return (
    <div>
      <h1 className="page-title">{t('common.settings')}</h1>
      <p className="page-sub">Manage your profile, preferences and account security.</p>

      {/* Profile */}
      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-head">
          <h3>Profile</h3>
          {canEditContact && !editingContact && (
            <button type="button" className="settings-edit-btn" onClick={startEditingContact}>
              <Pencil size={13} /> Edit contact info
            </button>
          )}
        </div>

        <div className="settings-profile-row">
          <div className="shell-avatar settings-avatar">{initials}</div>
          <div>
            <div className="settings-profile-name">{displayName}</div>
            <div className="settings-profile-role">{roleLabel}</div>
          </div>
        </div>

        {!editingContact ? (
          <>
            <div className="settings-detail-grid">
              <div className="settings-detail">
                <span className="settings-detail-label">
                  <Mail size={13} /> Login email
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
              {profile?.email && (
                <div className="settings-detail">
                  <span className="settings-detail-label">
                    <Mail size={13} /> Contact email
                  </span>
                  <span className="settings-detail-value">{profile.email}</span>
                </div>
              )}
              {showAddress && profile?.address && (
                <div className="settings-detail">
                  <span className="settings-detail-label">
                    <MapPin size={13} /> Address
                  </span>
                  <span className="settings-detail-value">{profile.address}</span>
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
            {contactSuccess && (
              <p className="success-text" style={{ marginTop: 14 }}>
                {contactSuccess}
              </p>
            )}
          </>
        ) : (
          <form onSubmit={handleSaveContact} className="settings-contact-form">
            <div className="field">
              <label htmlFor="contactPhone">Phone</label>
              <div className="input-shell">
                <Phone size={16} />
                <input
                  id="contactPhone"
                  type="tel"
                  required
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="contactEmail">Contact email (optional)</label>
              <div className="input-shell">
                <Mail size={16} />
                <input
                  id="contactEmail"
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                />
              </div>
            </div>
            {showAddress && (
              <div className="field">
                <label htmlFor="contactAddress">Address (optional)</label>
                <div className="input-shell">
                  <MapPin size={16} />
                  <input
                    id="contactAddress"
                    type="text"
                    value={contactAddress}
                    onChange={(e) => setContactAddress(e.target.value)}
                  />
                </div>
              </div>
            )}
            {contactError && <p className="error-text">{contactError}</p>}
            <div className="settings-contact-actions">
              <button className="btn settings-password-submit" type="submit" disabled={contactSubmitting}>
                {contactSubmitting ? <span className="login-spinner" aria-hidden="true" /> : 'Save changes'}
              </button>
              <button
                type="button"
                className="btn-outline settings-cancel-btn"
                onClick={() => setEditingContact(false)}
                disabled={contactSubmitting}
              >
                <X size={14} /> Cancel
              </button>
            </div>
          </form>
        )}

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

      {/* Notification preferences */}
      {prefs && (
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-head">
            <h3>Notifications</h3>
          </div>
          <p className="settings-pref-intro">
            Choose how you&apos;d like to be notified. This never affects your account security emails.
          </p>

          {user.role === 'GUARDIAN' && (
            <>
              <div className="settings-pref-row">
                <div>
                  <div className="settings-pref-label">Announcements by email</div>
                  <div className="settings-pref-sub">School and class announcements sent to your contact email.</div>
                </div>
                <Toggle
                  checked={prefs.emailAnnouncements}
                  disabled={prefSavingKey === 'emailAnnouncements'}
                  onChange={(next) => handlePrefToggle('emailAnnouncements', next)}
                  label="Announcements by email"
                />
              </div>
              <div className="settings-pref-row">
                <div>
                  <div className="settings-pref-label">Announcements by SMS</div>
                  <div className="settings-pref-sub">School and class announcements sent as a text message.</div>
                </div>
                <Toggle
                  checked={prefs.smsAnnouncements}
                  disabled={prefSavingKey === 'smsAnnouncements'}
                  onChange={(next) => handlePrefToggle('smsAnnouncements', next)}
                  label="Announcements by SMS"
                />
              </div>
            </>
          )}
          <div className="settings-pref-row">
            <div>
              <div className="settings-pref-label">Messages by email</div>
              <div className="settings-pref-sub">Get an email when someone sends you a direct message.</div>
            </div>
            <Toggle
              checked={prefs.emailMessages}
              disabled={prefSavingKey === 'emailMessages'}
              onChange={(next) => handlePrefToggle('emailMessages', next)}
              label="Messages by email"
            />
          </div>
          <div className="settings-pref-row">
            <div>
              <div className="settings-pref-label">Messages by SMS</div>
              <div className="settings-pref-sub">Get a text when someone sends you a direct message.</div>
            </div>
            <Toggle
              checked={prefs.smsMessages}
              disabled={prefSavingKey === 'smsMessages'}
              onChange={(next) => handlePrefToggle('smsMessages', next)}
              label="Messages by SMS"
            />
          </div>
          {prefError && (
            <p className="error-text" style={{ marginTop: 12 }}>
              {prefError}
            </p>
          )}
        </div>
      )}

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
          {pwError && <p className="error-text">{pwError}</p>}
          {pwSuccess && <p className="success-text">{pwSuccess}</p>}
          <button className="btn settings-password-submit" type="submit" disabled={pwSubmitting}>
            {pwSubmitting ? (
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
