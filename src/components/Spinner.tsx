export function Spinner({ label }: { label?: string }) {
  return (
    <span className="spinner" role="status" aria-live="polite">
      <span className="spinner__dot" aria-hidden="true" />
      <span className="spinner__text">{label ?? 'Loading…'}</span>
    </span>
  )
}

export function PageLoader({ label }: { label?: string }) {
  return (
    <div className="page-loader">
      <Spinner label={label} />
    </div>
  )
}
