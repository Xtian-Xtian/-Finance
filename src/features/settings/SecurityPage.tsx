import { useState, type FormEvent } from 'react'
import { ShieldCheck } from 'lucide-react'
import { Button, Card, CardHeader, FormError, Notice, PageHeader, TextField } from '../../components/ui'
import { useFinance } from '../../data/FinanceDataProvider'
import { formatDateTime } from '../../lib/dates'
import { hasErrors, passwordProblem, type Errors } from '../../lib/validation'
import { AuditLogList } from '../audit/AuditLogList'
import { useAuth } from '../auth/AuthProvider'
import { authErrorMessage, changePassword, logout } from '../auth/authService'

export function SecurityPage() {
  const { uid } = useFinance()
  const { user } = useAuth()
  const [form, setForm] = useState({ current: '', next: '', confirm: '' })
  const [errors, setErrors] = useState<Errors>({})
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const errs: Errors = {
      current: form.current ? undefined : 'Enter your current password.',
      next: passwordProblem(form.next) ?? (form.next === form.current ? 'Choose a different password.' : undefined),
      confirm: form.next === form.confirm ? undefined : 'Passwords do not match.',
    }
    setErrors(errs)
    setError(null)
    setDone(false)
    if (hasErrors(errs)) return
    setBusy(true)
    try {
      await changePassword(form.current, form.next)
      setForm({ current: '', next: '', confirm: '' })
      setDone(true)
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title="Security" description="Password, session and account activity." />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Session" />
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-faint">Signed in as</dt>
                <dd className="truncate">{user?.email}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-faint">Email verified</dt>
                <dd>{user?.emailVerified ? 'Yes' : 'No'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-faint">Last sign-in</dt>
                <dd>{formatDateTime(user?.metadata.lastSignInTime ? new Date(user.metadata.lastSignInTime) : null)}</dd>
              </div>
            </dl>
            <Button className="mt-4" variant="danger" onClick={() => void logout()}>
              Sign out
            </Button>
          </Card>

          <Card>
            <CardHeader title="Change password" />
            <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
              <TextField label="Current password" type="password" autoComplete="current-password" value={form.current} onChange={(e) => setForm({ ...form, current: e.target.value })} error={errors.current} />
              <TextField label="New password" type="password" autoComplete="new-password" value={form.next} onChange={(e) => setForm({ ...form, next: e.target.value })} error={errors.next} hint="At least 10 characters with upper, lower case and a number." />
              <TextField label="Confirm new password" type="password" autoComplete="new-password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} error={errors.confirm} />
              <FormError message={error} />
              {done && <Notice tone="accent">Password updated.</Notice>}
              <Button type="submit" variant="primary" loading={busy} className="self-start">
                Update password
              </Button>
            </form>
          </Card>

          <Notice>
            <span className="flex items-start gap-2">
              <ShieldCheck size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden />
              Your data is private to your account and protected by Firebase Authentication, Firestore Security Rules and App Check. We never store
              passwords, card CVVs, PINs or online banking credentials.
            </span>
          </Notice>
        </div>

        <Card>
          <CardHeader title="Recent activity" subtitle="Append-only audit log of sign-ins and changes." />
          <AuditLogList uid={uid} />
        </Card>
      </div>
    </>
  )
}
