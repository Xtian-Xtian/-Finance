import { useState } from 'react'
import { Button, FormError, Notice } from '../../components/ui'
import { useAuth } from './AuthProvider'
import { AuthLayout } from './AuthLayout'
import { authErrorMessage, logout, refreshVerification, resendVerification } from './authService'

export function VerifyEmailPage() {
  const { user } = useAuth()
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'check' | 'resend' | null>(null)

  async function check() {
    setBusy('check')
    setError(null)
    try {
      const verified = await refreshVerification()
      if (!verified) setError('Your email is not verified yet. Click the link in the email we sent.')
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  async function resend() {
    setBusy('resend')
    setError(null)
    try {
      await resendVerification()
      setMessage('Verification email sent.')
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <AuthLayout title="Verify your email" subtitle="Financial data is only available to verified accounts.">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-muted">
          We sent a verification link to <span className="font-medium text-ink">{user?.email}</span>. Open it, then come back and continue.
        </p>
        {message && <Notice tone="accent">{message}</Notice>}
        <FormError message={error} />
        <Button variant="primary" loading={busy === 'check'} onClick={check}>
          I've verified my email
        </Button>
        <Button loading={busy === 'resend'} onClick={resend}>
          Resend email
        </Button>
        <Button variant="ghost" onClick={() => void logout()}>
          Use a different account
        </Button>
      </div>
    </AuthLayout>
  )
}
