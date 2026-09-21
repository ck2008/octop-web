import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { useAuth } from '../hooks/useAuth'
import { PageLoader } from './Spinner'

/** Sends signed-out visitors to /login, remembering where they were headed. */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) return <PageLoader label="Checking your session…" />

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <>{children}</>
}

/** The mirror image: /login and /register bounce signed-in users home. */
export function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()

  if (loading) return <PageLoader label="Checking your session…" />
  if (session) return <Navigate to="/" replace />

  return <>{children}</>
}
