import { useState } from 'react'
import { Link } from 'react-router-dom'

import { APP_NAME } from '../config/app'
import { useAuth } from '../hooks/useAuth'

export function Header() {
  const { user, signOut } = useAuth()
  const [busy, setBusy] = useState(false)

  async function handleSignOut() {
    setBusy(true)
    try {
      await signOut()
    } finally {
      setBusy(false)
    }
  }

  return (
    <header className="app-header">
      <Link to="/" className="app-header__brand">
        {APP_NAME}
      </Link>

      <div className="app-header__user">
        {user?.email && (
          <span className="app-header__email" title={user.email}>
            {user.email}
          </span>
        )}
        <button
          type="button"
          className="button button--ghost"
          onClick={handleSignOut}
          disabled={busy}
        >
          {busy ? 'Signing out…' : 'Log out'}
        </button>
      </div>
    </header>
  )
}
