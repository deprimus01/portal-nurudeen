'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth-context';
import { RouteLoader } from '../components/ui/RouteLoader';

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (user.mustResetPassword) {
      router.replace('/reset-password');
      return;
    }
    if (user.role === 'ADMIN') router.replace('/admin');
    else if (user.role === 'TEACHER') router.replace('/teacher');
    else if (user.role === 'GUARDIAN') router.replace('/guardian');
    else if (user.role === 'STUDENT') router.replace('/student');
    else router.replace('/portal-coming-soon');
  }, [loading, user, router]);

  return <RouteLoader />;
}
