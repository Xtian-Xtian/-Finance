import { useEffect, useState, type FormEvent } from 'react'
import { updateProfile } from 'firebase/auth'
import { Button, Card, CardHeader, FormError, Notice, PageHeader, Segmented, TextField } from '../../components/ui'
import { useTheme, type ThemePreference } from '../../app/ThemeProvider'
import { useFinance } from '../../data/FinanceDataProvider'
import { auth } from '../../lib/firebase'
import { useAsyncAction } from '../../lib/useAsyncAction'
import { requireText } from '../../lib/validation'
import { logAudit } from '../audit/auditService'
import { CategoryManager } from '../categories/CategoryManager'
import { CoachSetupCard } from '../coach/CoachSetupCard'
import { GmailImportCard } from '../gmailImport/GmailImportCard'
import { getProfile, updateDisplayName } from './profileService'

export function SettingsPage() {
  const { uid } = useFinance()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [nameError, setNameError] = useState<string>()
  const [saved, setSaved] = useState(false)
  const { busy, error, run } = useAsyncAction()

  useEffect(() => {
    getProfile(uid).then((p) => {
      if (p) {
        setName(p.displayName)
        setEmail(p.email)
      }
    })
  }, [uid])

  async function submit(e: FormEvent) {
    e.preventDefault()
    const err = requireText(name, 'Name', 60)
    setNameError(err)
    setSaved(false)
    if (err) return
    await run(async () => {
      await updateDisplayName(uid, name)
      if (auth.currentUser) await updateProfile(auth.currentUser, { displayName: name.trim() })
      await logAudit(uid, { action: 'profile.updated', entityType: 'profile', entityId: uid, details: 'Display name changed' })
    }, () => setSaved(true))
  }

  return (
    <>
      <PageHeader title="Settings" description="Profile, currency and categories." />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Profile" />
            <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
              <TextField label="Display name" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} error={nameError} />
              <TextField label="Email" value={email} disabled hint="Your sign-in email is managed by Firebase Authentication." />
              <FormError message={error} />
              {saved && <Notice tone="accent">Profile saved.</Notice>}
              <Button type="submit" variant="primary" loading={busy} className="self-start">
                Save profile
              </Button>
            </form>
          </Card>
          <AppearanceCard />
          <Card>
            <CardHeader title="Currency" />
            <p className="text-sm text-ink-muted">
              All amounts are in <span className="font-medium text-ink">Philippine Peso (PHP, ₱)</span> and stored as exact centavos to avoid rounding errors.
            </p>
          </Card>
        </div>
        <CategoryManager />
        <div className="lg:col-span-2">
          <GmailImportCard />
        </div>
        <div className="lg:col-span-2">
          <CoachSetupCard />
        </div>
      </div>
    </>
  )
}

function AppearanceCard() {
  const { preference, resolved, setPreference } = useTheme()
  return (
    <Card>
      <CardHeader title="Appearance" subtitle="Saved on this device." />
      <Segmented<ThemePreference>
        label="Theme"
        value={preference}
        onChange={setPreference}
        options={[
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
          { value: 'system', label: 'System' },
        ]}
      />
      <p className="mt-3 text-xs text-ink-faint">
        {preference === 'system'
          ? `Following your device setting — currently ${resolved}. It switches automatically when your device does.`
          : `Always ${preference}, regardless of your device setting.`}
      </p>
    </Card>
  )
}
