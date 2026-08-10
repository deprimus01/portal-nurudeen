'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  AlertTriangle,
  LucideIcon,
  LogIn,
  RotateCw,
  SearchX,
  ServerCrash,
  ShieldOff,
  WifiOff,
} from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import type { ErrorKind } from '../../lib/errors';

const PRESETS: Record<ErrorKind, { icon: LucideIcon; title: string; tone: string }> = {
  validation: { icon: AlertCircle, title: 'Check the highlighted details', tone: 'rgba(201, 151, 74, 0.14)' },
  network: { icon: WifiOff, title: "You're offline", tone: 'rgba(152, 162, 179, 0.16)' },
  auth: { icon: LogIn, title: 'Your session has ended', tone: 'rgba(16, 54, 125, 0.12)' },
  permission: { icon: ShieldOff, title: 'Access restricted', tone: 'rgba(201, 151, 74, 0.16)' },
  'not-found': { icon: SearchX, title: "We couldn't find that", tone: 'rgba(152, 162, 179, 0.16)' },
  server: { icon: ServerCrash, title: 'Something went wrong', tone: 'rgba(220, 38, 38, 0.1)' },
  unknown: { icon: AlertTriangle, title: 'Something went wrong', tone: 'rgba(220, 38, 38, 0.1)' },
};

interface ErrorStateProps {
  kind?: ErrorKind;
  /** Overrides the default heading for this kind. */
  title?: string;
  /** The calm, specific explanation - required. */
  description: string;
  /** Overrides the default icon for this kind. */
  icon?: LucideIcon;
  /** Shows a "Try Again" button that re-runs the failed action. */
  onRetry?: () => void;
  /** Shows a "Go Back" button that returns to the previous page. */
  showGoBack?: boolean;
  /** Shows a "Return to Dashboard" link. Defaults to true for auth/permission/not-found. */
  showDashboardLink?: boolean;
  /** Smaller footprint for use inside cards/panels rather than a full page. */
  compact?: boolean;
}

function dashboardPathFor(role?: string) {
  switch (role) {
    case 'TEACHER':
      return '/teacher';
    case 'GUARDIAN':
      return '/guardian';
    case 'STUDENT':
      return '/student';
    case 'ADMIN':
      return '/admin';
    default:
      return '/login';
  }
}

export function ErrorState({
  kind = 'unknown',
  title,
  description,
  icon,
  onRetry,
  showGoBack,
  showDashboardLink,
  compact = false,
}: ErrorStateProps) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const preset = PRESETS[kind];
  const Icon = icon || preset.icon;
  const resolvedTitle = title || preset.title;
  const dashboardHref = dashboardPathFor(user?.role);
  const showDashboard = showDashboardLink ?? (kind === 'permission' || kind === 'not-found');

  return (
    <motion.div
      className={`empty-state error-state${compact ? ' empty-state-compact' : ''}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="empty-illustration" style={{ background: `radial-gradient(circle, ${preset.tone}, transparent 70%)` }}>
        <Icon size={compact ? 26 : 40} color={kind === 'server' || kind === 'unknown' ? 'var(--danger)' : 'var(--muted-2)'} strokeWidth={1.75} />
      </div>
      <h3>{resolvedTitle}</h3>
      <p>{description}</p>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
        {kind === 'auth' ? (
          <button className="btn" onClick={logout} type="button">
            <LogIn size={15} /> Sign In Again
          </button>
        ) : onRetry ? (
          <button className="btn" onClick={onRetry} type="button">
            <RotateCw size={15} /> Try Again
          </button>
        ) : null}
        {showGoBack && (
          <button className="btn btn-outline" onClick={() => router.back()} type="button">
            Go Back
          </button>
        )}
        {showDashboard && (
          <button className="btn btn-outline" onClick={() => router.push(dashboardHref)} type="button">
            Return to Dashboard
          </button>
        )}
      </div>
    </motion.div>
  );
}
