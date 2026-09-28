import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ListOrdered, Sparkles, Target } from 'lucide-react'
import { Button, Card, CardHeader, FormError, MoneyField, TextAreaField } from '../../components/ui'
import { useFinance } from '../../data/FinanceDataProvider'
import { formatMoney, parseMoney } from '../../lib/money'
import { getProfile } from '../settings/profileService'
import { askCoach, CoachError, type CoachAdvice } from './coachService'
import { buildCoachSummary } from './coachSummary'

export function DebtCoachCard() {
  const data = useFinance()
  const [coachUrl, setCoachUrl] = useState<string | null | undefined>(undefined)
  const [question, setQuestion] = useState('')
  const [extra, setExtra] = useState('')
  const [advice, setAdvice] = useState<CoachAdvice | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showData, setShowData] = useState(false)

  useEffect(() => {
    getProfile(data.uid)
      .then((p) => setCoachUrl(p?.coachUrl ?? null))
      .catch(() => setCoachUrl(null))
  }, [data.uid])

  const summary = useMemo(() => buildCoachSummary(data), [data])

  async function ask() {
    if (!coachUrl) return
    const extraCentavos = extra.trim() ? parseMoney(extra) : null
    if (extra.trim() && extraCentavos === null) {
      setError('Enter a valid extra amount, e.g. 1000')
      return
    }
    setBusy(true)
    setError(null)
    try {
      setAdvice(await askCoach(coachUrl, summary, question, extraCentavos === null ? null : extraCentavos / 100))
    } catch (err) {
      setError(err instanceof CoachError ? err.message : 'The AI coach failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="mb-6">
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Sparkles size={16} className="text-accent" aria-hidden /> AI debt-free coach
          </span>
        }
        subtitle="Claude looks at your balances, debts and spending and suggests a plan."
      />

      {coachUrl === null ? (
        <p className="text-sm text-ink-muted">
          Not set up yet.{' '}
          <Link to="/settings" className="text-accent hover:underline">
            Connect the AI coach in Settings
          </Link>{' '}
          (about 5 minutes).
        </p>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-[1fr_220px]">
            <TextAreaField
              label="Your question (optional)"
              placeholder="e.g. Should I pay BillEase or the BPI card first? How fast can I be debt-free?"
              maxLength={500}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
            <MoneyField label="Extra I can pay monthly (optional)" value={extra} onChange={(e) => setExtra(e.target.value)} hint="Used for “what if” estimates." />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button variant="primary" icon={<Sparkles size={16} />} loading={busy} onClick={ask} disabled={coachUrl === undefined}>
              {advice ? 'Ask again' : 'Get my debt-free plan'}
            </Button>
            <button type="button" className="text-xs text-ink-faint hover:text-ink" onClick={() => setShowData((v) => !v)}>
              {showData ? 'Hide' : 'See'} exactly what is sent
            </button>
            {busy && <span className="text-xs text-ink-faint">Thinking… this can take up to a minute.</span>}
          </div>
          {showData && (
            <pre className="mt-3 max-h-64 overflow-auto rounded-lg border border-line bg-surface-2 p-3 text-[11px] text-ink-muted">{JSON.stringify(summary, null, 2)}</pre>
          )}
          <div className="mt-3">
            <FormError message={error} />
          </div>
        </>
      )}

      {advice && (
        <div className="mt-5 flex flex-col gap-5 border-t border-line pt-5">
          <p className="text-sm leading-relaxed text-ink">{advice.summary}</p>

          <div className="flex items-start gap-3 rounded-xl border border-accent/30 bg-accent-soft p-4">
            <Target size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden />
            <div>
              <p className="font-semibold text-ink">
                Debt-free estimate: {advice.debtFreeEstimate.targetMonth}
                {advice.debtFreeEstimate.months > 0 && <span className="font-normal text-ink-muted"> · about {advice.debtFreeEstimate.months} months</span>}
              </p>
              <p className="mt-1 text-sm text-ink-muted">{advice.debtFreeEstimate.basis}</p>
            </div>
          </div>

          {advice.payoffOrder.length > 0 && (
            <div>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-medium">
                <ListOrdered size={15} className="text-accent" aria-hidden /> Pay off in this order
              </h3>
              <ol className="space-y-2">
                {advice.payoffOrder.map((p, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-3 text-xs font-semibold">{i + 1}</span>
                    <span>
                      <span className="font-medium text-ink">{p.name}</span> <span className="text-ink-muted">— {p.reason}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {advice.actions.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-medium">What to do</h3>
              <ul className="grid gap-3 md:grid-cols-2">
                {advice.actions.map((a, i) => (
                  <li key={i} className="rounded-xl border border-line bg-surface-2/60 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-ink">{a.title}</p>
                      {a.monthlyImpactPhp > 0 && (
                        <span className="tabular shrink-0 text-xs text-positive">+{formatMoney(Math.round(a.monthlyImpactPhp * 100))}/mo</span>
                      )}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-ink-muted">{a.detail}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {advice.warnings.length > 0 && (
            <ul className="space-y-1.5">
              {advice.warnings.map((w, i) => (
                <li key={i} className="flex gap-2 text-sm text-warning">
                  <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden />
                  {w}
                </li>
              ))}
            </ul>
          )}

          <p className="text-[11px] text-ink-faint">
            AI-generated suggestions based on the data you recorded. Estimates, not guarantees or licensed financial advice — double-check with your lender's
            statements.
          </p>
        </div>
      )}
    </Card>
  )
}
