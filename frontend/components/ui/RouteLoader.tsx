interface RouteLoaderProps {
  label?: string;
}

// Shared splash/spinner markup. Used both by app/loading.tsx (Next's
// Suspense-based route fallback, which only fires for server-side segment
// transitions) and directly inside the role layouts (admin/teacher/guardian/
// student) while the client-side auth check in AuthProvider is resolving -
// that second case is what covers the "blank screen on first load" gap,
// since Next's loading.tsx convention doesn't apply to client-only loading
// states.
export function RouteLoader({ label = 'Loading your portal…' }: RouteLoaderProps) {
  return (
    <div className="route-loader" role="status" aria-live="polite" aria-label={label}>
      <div className="route-loader-mark">
        <span className="route-loader-ring" aria-hidden="true" />
        <img src="/images/logo.png" alt="" className="route-loader-logo" />
      </div>
      <span className="route-loader-text">{label}</span>
    </div>
  );
}
