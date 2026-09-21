import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { APP_NAME, APP_TAGLINE } from '../config/app'
import { useAuth } from '../hooks/useAuth'

export function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<'idle' | 'submitting'>('idle')
  const [error, setError] = useState<string | null>(null)

  const from = (location.state as { from?: string } | null)?.from ?? '/'

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (status === 'submitting') return

    setError(null)

    if (!email.trim()) {
      setError('Enter your email address.')
      return
    }
    if (!password) {
      setError('Enter your password.')
      return
    }

    setStatus('submitting')
    try {
      await signIn(email, password)
      navigate(from, { replace: true })
    } catch (cause) {
      // Supabase already returns a deliberately vague message for bad
      // credentials; passing it through avoids leaking whether the account
      // exists.
      setError(cause instanceof Error ? cause.message : 'Sign in failed.')
      setStatus('idle')
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit} noValidate>
        <h1 className="auth-card__title">{APP_NAME}</h1>
        <p className="auth-card__subtitle">{APP_TAGLINE}</p>

        <label className="field">
          <span className="field__label">Email</span>
          <input
            className="field__input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={status === 'submitting'}
            required
          />
        </label>

        <label className="field">
          <span className="field__label">Password</span>
          <input
            className="field__input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={status === 'submitting'}
            required
          />
        </label>

        {error && <p className="form__error">{error}</p>}

        <button
          type="submit"
          className="button button--primary button--block"
          disabled={status === 'submitting'}
        >
          {status === 'submitting' ? 'Signing in…' : 'Sign in'}
        </button>

        <p className="auth-card__footer">
          No account yet? <Link to="/register">Create one</Link>
        </p>
      </form>
    </div>
  )
}
