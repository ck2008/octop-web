import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { APP_NAME, LIMITS } from '../config/app'
import { useAuth } from '../hooks/useAuth'

export function RegisterPage() {
  const { signUp } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [status, setStatus] = useState<'idle' | 'submitting'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [confirmationSent, setConfirmationSent] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (status === 'submitting') return

    setError(null)

    if (!email.trim()) {
      setError('Enter your email address.')
      return
    }
    if (password.length < LIMITS.passwordMin) {
      setError(`Password must be at least ${LIMITS.passwordMin} characters.`)
      return
    }
    if (password !== confirmPassword) {
      setError('The two passwords do not match.')
      return
    }

    setStatus('submitting')
    try {
      const { needsConfirmation } = await signUp(email, password)
      if (needsConfirmation) {
        // Email confirmation is on in this project: there is no session yet.
        setConfirmationSent(true)
        setStatus('idle')
        return
      }
      // Otherwise the auth listener already has a session; land on Projects.
      navigate('/', { replace: true })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sign up failed.')
      setStatus('idle')
    }
  }

  if (confirmationSent) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1 className="auth-card__title">Check your inbox</h1>
          <p className="auth-card__subtitle">
            We sent a confirmation link to {email.trim()}. Open it, then sign
            in.
          </p>
          <Link to="/login" className="button button--primary button--block">
            Go to sign in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit} noValidate>
        <h1 className="auth-card__title">Create your {APP_NAME} account</h1>

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
          <span className="field__label">
            Password
            <span className="field__hint">
              at least {LIMITS.passwordMin} characters
            </span>
          </span>
          <input
            className="field__input"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={status === 'submitting'}
            required
          />
        </label>

        <label className="field">
          <span className="field__label">Confirm password</span>
          <input
            className="field__input"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
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
          {status === 'submitting' ? 'Creating account…' : 'Create account'}
        </button>

        <p className="auth-card__footer">
          Already registered? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </div>
  )
}
