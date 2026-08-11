'use client';

import { useEffect } from 'react';
import { ErrorState } from '../../components/ui/ErrorState';

// Scoped to /admin: Next.js renders this in place of the crashing page's
// content while leaving app/admin/layout.tsx (AppShell - sidebar, topbar,
// nav links, toggles, search) mounted above it. Without this file, an
// error anywhere under /admin bubbles all the way up to the root
// app/error.tsx instead, which sits *above* AdminLayout and so unmounts
// the whole shell - sidebar included - leaving only a bare "Something
// went wrong" screen with no nav. That's what made a single widget crash
// look like the entire site had frozen: every nav item, toggle, and
// select disappeared with it, not because it stopped responding but
// because it was removed from the page.
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
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
