export default function Loading() {
  return (
    <div className="route-loader" role="status" aria-live="polite" aria-label="Loading Nuruddeen SMS">
      <div className="route-loader-mark">
        <span className="route-loader-ring" aria-hidden="true" />
        <img src="/images/logo.png" alt="" className="route-loader-logo" />
      </div>
      <span className="route-loader-text">Loading your portal…</span>
    </div>
  );
}
