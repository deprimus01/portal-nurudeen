'use client';

import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { api } from '../../lib/api';
import type { PortalUserSummary } from '../../lib/types';
import { getErrorMessage } from '../../lib/errors';

interface ForceResetPasswordButtonProps {
  user?: PortalUserSummary | null;
  /** Shown in the confirm prompt, e.g. "Aisha Bello" */
  displayName: string;
}

// Drop-in row action for the Staff / Guardians / Students admin tables.
// Closes the recovery gap: the temp password shown on account creation is
// one-time-only and never recoverable afterwards (only a bcrypt hash is
// stored), so this is the only way back in if that banner got dismissed.
// Mirrors the "credentials just issued" banner pattern already used on
// account creation (see app/admin/staff/page.tsx / students/page.tsx).
export function ForceResetPasswordButton({ user, displayName }: ForceResetPasswordButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ email: string; tempPassword: string } | null>(null);

  if (!user) {
    return <span style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>No portal account</span>;
  }

  async function handleClick() {
    if (
      !confirm(
        `Reset ${displayName}'s password? Their current password will stop working immediately, and they'll need the new temporary password to log in.`,
      )
    ) {
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await api.post<{ email: string; tempPassword: string }>(
        `/api/users/${user!.id}/force-reset-password`,
        {},
      );
      setResult(res);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to reset password.'));
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <div
        className="card"
        style={{ padding: '0.7rem 0.9rem', borderColor: 'var(--success)', maxWidth: 280 }}
      >
        <p style={{ fontSize: '0.82rem', margin: 0 }}>
          New password for {result.email}: <code>{result.tempPassword}</code>
        </p>
        <p style={{ fontSize: '0.72rem', color: 'var(--muted)', margin: '0.3rem 0 0.5rem' }}>
          Also emailed. Won&apos;t be shown again - copy it now.
        </p>
        <button className="btn btn-outline" style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem' }} onClick={() => setResult(null)}>
          Dismiss
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        className="btn btn-outline"
        style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}
        onClick={handleClick}
        disabled={busy}
      >
        <KeyRound size={13} />
        {busy ? 'Resetting…' : 'Force reset password'}
      </button>
      {error && <p className="error-text" style={{ fontSize: '0.75rem', marginTop: 4 }}>{error}</p>}
    </div>
  );
}
