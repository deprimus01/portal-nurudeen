'use client';

import { useEffect } from 'react';
import { ErrorState } from '../components/ui/ErrorState';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Never shown to the user - this is the one place a raw stack trace
    // is genuinely useful, and it belongs in the console, not the UI.
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  return (
    <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <ErrorState
        kind="unknown"
        title="Something went wrong"
        description="This page ran into a problem. Try again, or head back to your dashboard."
        onRetry={reset}
        showDashboardLink
      />
    </div>
  );
}
