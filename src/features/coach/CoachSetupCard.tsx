import { useEffect, useState, type FormEvent } from 'react'
import { Sparkles } from 'lucide-react'
import { Button, Card, CardHeader, FormError, Notice, TextField } from '../../components/ui'
import { useFinance } from '../../data/FinanceDataProvider'
import { useAsyncAction } from '../../lib/useAsyncAction'
import { logAudit } from '../audit/auditService'
import { getProfile, updateCoachUrl } from '../settings/profileService'
import { COACH_URL_PATTERN } from './coachService'

export function CoachSetupCard() {
  const { uid } = useFinance()
  const [url, setUrl] = useState('')
  const [saved, setSaved] = useState<string | null>(null)
  const [fieldError, setFieldError] = useState<string>()
  const { busy, error, run } = useAsyncAction()

  useEffect(() => {
    getProfile(uid).then((p) => {
      setUrl(p?.coachUrl ?? '')
      setSaved(p?.coachUrl ?? null)
    }).catch(() => setSaved(null))
  }, [uid])

  async function submit(e: FormEvent) {
    e.preventDefault()
    const value = url.trim()
    if (value && !COACH_URL_PATTERN.test(value)) {
      setFieldError('Paste the Web app URL from Apps Script. It looks like https://script.google.com/macros/s/…/exec')
      return
    }
    setFieldError(undefined)
    await run(async () => {
      await updateCoachUrl(uid, value || null)
      await logAudit(uid, { action: 'coach.configured', entityType: 'coach', details: value ? 'AI coach connected' : 'AI coach disconnected' })
      setSaved(value || null)
    })
  }

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Sparkles size={16} className="text-accent" aria-hidden /> AI debt coach (Claude)
          </span>
        }
        subtitle={saved ? 'Connected — find it on the Goals page.' : 'Optional. Runs through your own Google Apps Script.'}
      />
      <ol className="mb-4 list-decimal space-y-1.5 pl-5 text-sm text-ink-muted">
        <li>
          Get an API key at{' '}
          <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
            console.anthropic.com
          </a>{' '}
          (add a little credit under Billing).
        </li>
        <li>Generate and paste the latest script above into your Apps Script project, then save.</li>
        <li>
          In Apps Script: <strong>Project Settings</strong> (gear) → <strong>Script properties</strong> → <strong>Add</strong>: name{' '}
          <code>ANTHROPIC_API_KEY</code>, value = your key.
        </li>
        <li>
          <strong>Deploy → New deployment</strong> → type <strong>Web app</strong> → Execute as <strong>Me</strong>, Who has access <strong>Anyone</strong> → Deploy.
        </li>
        <li>Copy the <strong>Web app URL</strong> and paste it below.</li>
      </ol>
      <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
        <TextField label="Web app URL" placeholder="https://script.google.com/macros/s/…/exec" value={url} onChange={(e) => setUrl(e.target.value)} error={fieldError} />
        <FormError message={error} />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="primary" loading={busy}>
            {saved ? 'Update' : 'Connect coach'}
          </Button>
          {saved && (
            <Button
              variant="ghost"
              onClick={() => {
                setUrl('')
                void run(async () => {
                  await updateCoachUrl(uid, null)
                  setSaved(null)
                })
              }}
            >
              Disconnect
            </Button>
          )}
        </div>
      </form>
      <div className="mt-4">
        <Notice>
          Your API key stays in Google, never in this website. Each request is checked against your Finance login and limited to 15 per day.
          Only a summary (balances, debts, monthly and category totals) is sent to Anthropic — no transaction descriptions or card numbers.
        </Notice>
      </div>
    </Card>
  )
}
