import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button, FormError, TextField } from '../../components/ui'
import { isEmail } from '../../lib/validation'
import { AuthLayout } from './AuthLayout'
import { authErrorMessage, login, loginLockRemainingMs } from './authService'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!isEmail(email) || !password) {
      setError('Enter your email and password.')
      return
    }
    const lock = loginLockRemainingMs()
    if (lock > 0) {
      setError(`Too many attempts. Try again in ${Math.ceil(lock / 1000)} seconds.`)
      return
    }
    setBusy(true)
    try {
      await login(email, password, remember)
    } catch (err) {
      setError(authErrorMessage(err))
      setPassword('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to your personal finance dashboard.">
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <TextField label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 text-ink-muted">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="accent-[var(--color-accent)]" />
            Keep me signed in
          </label>
          <Link to="/reset-password" className="text-accent hover:underline">
            Forgot password?
          </Link>
        </div>
        <FormError message={error} />
        <Button type="submit" variant="primary" loading={busy}>
          Sign in
        </Button>
        <p className="text-center text-sm text-ink-faint">
          New here?{' '}
          <Link to="/register" className="text-accent hover:underline">
            Create an account
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
