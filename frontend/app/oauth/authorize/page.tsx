'use client';

// This page exists because of an architectural detail: SMS sessions are
// Bearer tokens in localStorage (see lib/api.ts), not cookies — so a
// plain top-level browser redirect from the backend's GET /oauth/authorize
// can't see whether the visitor is already logged in (localStorage isn't
// sent on navigations, and there's no Authorization header to read on a
// full-page GET). The backend already validated client_id/redirect_uri
// and bounced the browser here (see backend/src/routes/oauth.routes.js);
// this page's job is just: figure out if we have a session (reusing the
// same AuthProvider check every other page uses), send the visitor to
// /login first if not, then hand the OAuth params to the backend's
// authenticated POST /oauth/authorize to mint a code, and finally do the
// actual browser redirect to the CMS's callback with that code — exactly
// matching ADR-001 §4's "Follows redirect, lands on existing SMS login...
// SMS redirect to CMS redirect_uri (authorization code, state)".

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '../../../lib/auth-context';
import { api } from '../../../lib/api';
import { getErrorMessage } from '../../../lib/errors';

const OAUTH_PARAM_KEYS = ['response_type', 'client_id', 'redirect_uri', 'code_challenge', 'code_challenge_method', 'state'];

function AuthorizeInner() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return; // wait for AuthProvider's initial /api/auth/me check

    const params: Record<string, string> = {};
    for (const key of OAUTH_PARAM_KEYS) {
      const value = searchParams.get(key);
      if (value) params[key] = value;
    }

    if (Object.keys(params).length !== OAUTH_PARAM_KEYS.length) {
      setError('This sign-in link is missing required information. Please return to the website and try again.');
      return;
    }

    if (!user) {
      const currentPath = `/oauth/authorize?${searchParams.toString()}`;
      router.replace(`/login?next=${encodeURIComponent(currentPath)}`);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const result = await api.post<{ redirectUrl: string }>('/oauth/authorize', params);
        if (!cancelled) {
          // A genuine full-page navigation to the CMS's own origin — not
          // a client-side router.push, which only handles routes within
          // this app. This is the step the ADR-001 diagram shows as
          // "SMS redirect to CMS redirect_uri (authorization code, state)".
          window.location.href = result.redirectUrl;
        }
      } catch (err) {
        if (!cancelled) {
          setError(getErrorMessage(err, 'Could not complete sign-in. Please return to the website and try again.'));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user]);

  return (
    <div className="login-wrap">
      <div className="login-ambient" aria-hidden="true" />
      <div className="card login-card" style={{ textAlign: 'center' }}>
        {error ? (
          <>
            <h2>Sign-in couldn&apos;t continue</h2>
            <p className="login-sub">{error}</p>
          </>
        ) : (
          <>
            <span className="login-spinner" aria-hidden="true" style={{ margin: '0 auto 1rem' }} />
            <p className="login-sub">Signing you in…</p>
          </>
        )}
      </div>
    </div>
  );
}

export default function OAuthAuthorizePage() {
  return (
    <Suspense fallback={null}>
      <AuthorizeInner />
    </Suspense>
  );
}
