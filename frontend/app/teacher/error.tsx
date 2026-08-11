'use client';

import { useEffect } from 'react';
import { ErrorState } from '../../components/ui/ErrorState';

// Scoped to /teacher - see app/admin/error.tsx for why this file needs to
// exist per role rather than relying on the root app/error.tsx alone.
export default function TeacherError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  return (
    <div style={{ minHeight: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <ErrorState
        kind="unknown"
        title="This page ran into a problem"
        description="Try again, or use the sidebar to head somewhere else - the rest of the portal is unaffected."
        onRetry={reset}
      />
    </div>
  );
}
