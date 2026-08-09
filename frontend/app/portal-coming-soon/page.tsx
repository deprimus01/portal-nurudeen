'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Compass } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';

// Unreachable in normal use now - every defined role (Admin, Teacher,
// Guardian, Student) has a real portal and gets routed there. This stays
// only as a generic fallback for an unrecognized/future role.
export default function PortalComingSoonPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (loading || !user) return null;

  return (
    <div className="auth-shell">
      <motion.div
        className="card auth-card"
        style={{ textAlign: 'center', padding: '2.25rem 2rem' }}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="empty-illustration" style={{ margin: '0 auto 18px' }}>
          <Compass size={40} color="var(--muted-2)" />
        </div>
        <h1 style={{ fontSize: '1.1rem' }}>Portal access coming soon</h1>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginTop: 6 }}>
          There isn&apos;t a portal view for your account type yet. You&apos;re signed in - contact
          the school office if this looks wrong.
        </p>
        <button className="btn btn-outline" onClick={logout} style={{ marginTop: '1.25rem' }}>
          Log out
        </button>
      </motion.div>
    </div>
  );
}
