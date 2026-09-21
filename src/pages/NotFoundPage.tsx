import { Link } from 'react-router-dom'

import { EmptyState } from '../components/EmptyState'

export function NotFoundPage() {
  return (
    <section className="page">
      <EmptyState
        title="Page not found"
        description="That route does not exist."
        action={
          <Link to="/" className="button button--primary">
            Back to projects
          </Link>
        }
      />
    </section>
  )
}
