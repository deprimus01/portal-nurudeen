'use client';

import { ErrorState } from '../components/ui/ErrorState';

export default function NotFound() {
  return (
    <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <ErrorState
        kind="not-found"
        title="Page not found"
        description="The page you're looking for doesn't exist or may have moved."
        showGoBack
        showDashboardLink
      />
    </div>
  );
}
