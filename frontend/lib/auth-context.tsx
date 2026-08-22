'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

import { api } from './api';
import { getToken, setToken, clearToken } from './api';
import type { SessionUser } from './types';

interface AuthContextValue {
  user: SessionUser | null;
  loading: boolean;
  login: (email: string, password: string, next?: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  async function refresh() {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await api.get<SessionUser>('/api/auth/me');
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(email: string, password: string, next?: string) {
    const result = await api.post<{ token: string; user: SessionUser }>('/api/auth/login', {
      email,
      password,
    });
    setToken(result.token);
    await refresh();
    if (result.user.mustResetPassword) {
      // A password reset is required before continuing anywhere else —
      // including resuming an in-progress CMS SSO handoff. `next` is
      // deliberately dropped here rather than carried through to after
      // the reset; re-visiting the CMS's login link is the simpler path
      // and avoids the reset-password page needing to know about OAuth.
      router.push('/reset-password');
    } else if (next && next.startsWith('/')) {
      // Only ever an internal path (enforced by the leading-slash check)
      // — never redirect to an attacker-supplied external URL from a
      // query param.
      router.push(next);
    } else {
      router.push('/admin');
    }
  }

  function logout() {
    clearToken();
    setUser(null);
    router.push('/login');
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
