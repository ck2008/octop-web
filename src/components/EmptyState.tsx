import type { ReactNode } from 'react'

interface EmptyStateProps {
  title: string
  description?: string
  /** Primary call to action - every empty state should offer the next step. */
  action?: ReactNode
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <h3 className="empty-state__title">{title}</h3>
      {description && <p className="empty-state__text">{description}</p>}
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  )
}
