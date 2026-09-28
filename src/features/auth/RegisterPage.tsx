import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button, FormError, TextField } from '../../components/ui'
import { hasErrors, isEmail, passwordProblem, requireText, type Errors } from '../../lib/validation'
import { AuthLayout } from './AuthLayout'
import { authErrorMessage, register } from './authService'

export function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [errors, setErrors] = useState<Errors>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value })

  async function submit(e: FormEvent) {
    e.preventDefault()
    const next: Errors = {
      name: requireText(form.name, 'Name', 60),
      email: isEmail(form.email) ? undefined : 'Enter a valid email.',
      password: passwordProblem(form.password),
      confirm: form.password === form.confirm ? undefined : 'Passwords do not match.',
    }
    setErrors(next)
    setError(null)
    if (hasErrors(next)) return
    setBusy(true)
    try {
      await register(form.name, form.email, form.password)
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout title="Create your account" subtitle="Track spending, budgets, savings and net worth in one place.">
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <TextField label="Name" autoComplete="name" value={form.name} onChange={set('name')} error={errors.name} />
        <TextField label="Email" type="email" autoComplete="email" value={form.email} onChange={set('email')} error={errors.email} />
        <TextField
          label="Password"
          type="password"
          autoComplete="new-password"
          value={form.password}
          onChange={set('password')}
          error={errors.password}
          hint="At least 10 characters with upper, lower case and a number."
        />
        <TextField label="Confirm password" type="password" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} error={errors.confirm} />
        <FormError message={error} />
        <Button type="submit" variant="primary" loading={busy}>
          Create account
        </Button>
        <p className="text-center text-sm text-ink-faint">
          Already have an account?{' '}
          <Link to="/login" className="text-accent hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
