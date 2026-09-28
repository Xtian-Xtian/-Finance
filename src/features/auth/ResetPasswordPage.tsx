import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button, FormError, Notice, TextField } from '../../components/ui'
import { isEmail } from '../../lib/validation'
import { AuthLayout } from './AuthLayout'
import { authErrorMessage, requestPasswordReset } from './authService'

export function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!isEmail(email)) {
      setError('Enter a valid email.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await requestPasswordReset(email)
      setSent(true)
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout title="Reset password" subtitle="We'll email you a secure link to set a new password.">
      {sent ? (
        <div className="flex flex-col gap-4">
          <Notice tone="accent">If an account exists for that email, a reset link is on its way.</Notice>
          <Link to="/login" className="text-center text-sm text-accent hover:underline">
            Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <TextField label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <FormError message={error} />
          <Button type="submit" variant="primary" loading={busy}>
            Send reset link
          </Button>
          <Link to="/login" className="text-center text-sm text-ink-faint hover:text-ink">
            Back to sign in
          </Link>
        </form>
      )}
    </AuthLayout>
  )
}
