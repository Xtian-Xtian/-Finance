import { useMemo, useState } from 'react'
import { AlertTriangle, CalendarCheck, Lightbulb, ListOrdered, PiggyBank, Rocket } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { axisPropsFor, useChartTheme } from '../../components/charts/chartTheme'
import { ChartTooltip } from '../../components/charts/ChartTooltip'
import { Card, CardHeader, EmptyState, MoneyField, Segmented } from '../../components/ui'
import { useFinance } from '../../data/FinanceDataProvider'
import { formatMoney, formatMoneyCompact, parseMoney, toMoneyInput } from '../../lib/money'
import { isLiability } from '../accounts/types'
import { billStatus } from '../bills/billCalc'
import { liquidBalance } from '../networth/netWorthCalc'
import { spendingByCategory, totalsBetween } from '../transactions/transactionCalc'
import { buildSuggestions, defaultBudget, defaultMinimum, simulatePayoff, totalMinimums, type PlanDebt, type Strategy, type Suggestion } from './debtPlanner'

const STORE_KEY = 'pf.debtPlanner.v1'

interface Saved {
  strategy?: Strategy
  budget?: string
  overrides?: Record<string, { apr?: string; min?: string }>
}

function load(): Saved {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}') as Saved
  } catch {
    return {}
  }
}

function save(s: Saved) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(s))
  } catch {
    /* storage unavailable — settings just won't persist */
  }
}

const PER_MONTH = { weekly: 52 / 12, monthly: 1, quarterly: 1 / 3, yearly: 1 / 12 } as const

const ICON: Record<Suggestion['kind'], typeof Lightbulb> = { plan: ListOrdered, save: PiggyBank, boost: Rocket, warning: AlertTriangle }
const TONE: Record<Suggestion['kind'], string> = {
  plan: 'text-accent',
  save: 'text-positive',
  boost: 'text-accent',
  warning: 'text-warning',
}

function addMonths(n: number) {
  const d = new Date()
  d.setMonth(d.getMonth() + n)
  return d.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })
}

export function DebtPlannerCard() {
  const CHART = useChartTheme()
  const axisProps = axisPropsFor(CHART)
  const { accounts, balances, debts, transactions, categories, bills, netWorth } = useFinance()
  const [saved, setSaved] = useState<Saved>(load)
  const update = (next: Saved) => {
    setSaved(next)
    save(next)
  }

  // Everything the user owes: credit cards / loan accounts plus tracked debts.
  const baseDebts = useMemo(() => {
    const fromAccounts = accounts
      .filter((a) => a.status === 'active' && isLiability(a.type))
      .map((a) => ({ a, owed: Math.max(0, -(balances.get(a.id) ?? a.openingBalance)) }))
      .filter((x) => x.owed > 0)
      .map(({ a, owed }) => ({
        id: a.id,
        name: a.name,
        balance: owed,
        defaultApr: 36,
        defaultMin: defaultMinimum(a.type === 'credit_card' ? 'credit_card' : 'loan', owed),
        aprKnown: false,
      }))
    const fromDebts = debts
      .filter((d) => d.outstandingBalance > 0)
      .map((d) => ({
        id: d.id,
        name: d.name,
        balance: d.outstandingBalance,
        defaultApr: d.interestRate / 100,
        defaultMin: d.paymentAmount ? Math.round(d.paymentAmount * PER_MONTH[d.paymentFrequency]) : defaultMinimum('debt', d.outstandingBalance),
        aprKnown: true,
      }))
    return [...fromAccounts, ...fromDebts]
  }, [accounts, balances, debts])

  const planDebts: PlanDebt[] = baseDebts.map((d) => {
    const o = saved.overrides?.[d.id] ?? {}
    const apr = o.apr !== undefined && /^\d{1,3}(\.\d{1,2})?$/.test(o.apr) ? Math.min(100, Number(o.apr)) : d.defaultApr
    const min = o.min !== undefined ? parseMoney(o.min) : null
    return { id: d.id, name: d.name, balance: d.balance, apr, minPayment: min ?? d.defaultMin }
  })

  // Recent averages from the last 3 complete months that have data.
  const { avgIncome, avgExpenses } = useMemo(() => {
    const now = new Date()
    const months = [1, 2, 3]
      .map((back) => totalsBetween(transactions, new Date(now.getFullYear(), now.getMonth() - back, 1), new Date(now.getFullYear(), now.getMonth() - back + 1, 1)))
      .filter((t) => t.income || t.expenses)
    if (!months.length) return { avgIncome: null, avgExpenses: null }
    return {
      avgIncome: Math.round(months.reduce((s, t) => s + t.income, 0) / months.length),
      avgExpenses: Math.round(months.reduce((s, t) => s + t.expenses, 0) / months.length),
    }
  }, [transactions])

  const suggestedBudget = defaultBudget(planDebts, avgIncome, avgExpenses)
  const budget = (saved.budget ? parseMoney(saved.budget) : null) ?? suggestedBudget
  const strategy: Strategy = saved.strategy ?? 'avalanche'

  const result = simulatePayoff(planDebts, budget, strategy)
  const other = simulatePayoff(planDebts, budget, strategy === 'avalanche' ? 'snowball' : 'avalanche')

  const suggestions = useMemo(() => {
    const now = new Date()
    return buildSuggestions({
      debts: planDebts,
      monthlyBudget: budget,
      strategy,
      avgIncome,
      avgExpenses,
      liquid: liquidBalance(netWorth),
      topSpending: spendingByCategory(transactions, categories, new Date(now.getTime() - 30 * 86_400_000), now).map((c) => ({ name: c.name, amount: c.amount })),
      overdueBills: bills.filter((b) => billStatus(b) === 'overdue').map((b) => ({ name: b.name, amount: b.amount })),
      creditLines: accounts
        .filter((a) => a.type === 'credit_card' && a.status === 'active' && a.creditLimit)
        .map((a) => ({ name: a.name, owed: Math.max(0, -(balances.get(a.id) ?? a.openingBalance)), limit: a.creditLimit ?? 0 })),
    })
    // planDebts is derived from the listed inputs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(planDebts), budget, strategy, avgIncome, avgExpenses, netWorth, transactions, categories, bills, accounts, balances])

  const chart = result.timeline.map((v, i) => ({ label: i === 0 ? 'Now' : `M${i}`, balance: v }))

  const setOverride = (id: string, key: 'apr' | 'min', value: string) =>
    update({ ...saved, overrides: { ...saved.overrides, [id]: { ...saved.overrides?.[id], [key]: value } } })

  return (
    <Card className="mb-6">
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <CalendarCheck size={16} className="text-accent" aria-hidden /> Debt-free planner
          </span>
        }
        subtitle="Calculated from your accounts, debts and spending. Runs in your browser — nothing is sent anywhere."
      />

      {!planDebts.length ? (
        <EmptyState title="You have no recorded debt 🎉" description="Credit cards, loan accounts and entries under Debts show up here automatically." />
      ) : (
        <div className="flex flex-col gap-6">
          {/* Controls */}
          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
            <MoneyField
              label="Monthly amount for all debts"
              value={saved.budget ?? toMoneyInput(suggestedBudget)}
              onChange={(e) => update({ ...saved, budget: e.target.value })}
              hint={
                avgIncome !== null && avgExpenses !== null
                  ? `Suggested ${formatMoney(suggestedBudget)}: your average income ${formatMoney(avgIncome)} − spending ${formatMoney(avgExpenses)}, at least the minimums (${formatMoney(totalMinimums(planDebts))}).`
                  : `Minimum payments total ${formatMoney(totalMinimums(planDebts))}/month.`
              }
            />
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-ink-muted">Method</span>
              <Segmented
                label="Payoff method"
                value={strategy}
                onChange={(s) => update({ ...saved, strategy: s })}
                options={[
                  { value: 'avalanche', label: 'Highest interest first' },
                  { value: 'snowball', label: 'Smallest balance first' },
                ]}
              />
            </div>
          </div>

          {/* Headline */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="col-span-2 rounded-xl border border-accent/30 bg-accent-soft p-4">
              <p className="text-xs text-ink-muted">Debt-free by</p>
              <p className="mt-1 text-xl font-semibold text-ink">{result.feasible ? addMonths(result.months) : 'Not at this payment'}</p>
              <p className="text-xs text-ink-muted">{result.feasible ? `${result.months} month${result.months === 1 ? '' : 's'} from now` : 'See the suggestions below'}</p>
            </div>
            <div className="rounded-xl border border-line bg-surface-2/60 p-4">
              <p className="text-xs text-ink-faint">Total owed now</p>
              <p className="tabular mt-1 text-lg font-semibold">{formatMoney(planDebts.reduce((s, d) => s + d.balance, 0))}</p>
            </div>
            <div className="rounded-xl border border-line bg-surface-2/60 p-4">
              <p className="text-xs text-ink-faint">Interest you'll pay</p>
              <p className="tabular mt-1 text-lg font-semibold text-negative">{result.feasible ? formatMoney(result.totalInterest) : '—'}</p>
              {result.feasible && other.feasible && other.totalInterest !== result.totalInterest && (
                <p className="text-[11px] text-ink-faint">Other method: {formatMoney(other.totalInterest)} · {other.months} mo</p>
              )}
            </div>
          </div>

          {/* Chart */}
          {result.feasible && result.months > 1 && (
            <div className="h-48 w-full" role="img" aria-label="Remaining debt month by month">
              <ResponsiveContainer>
                <AreaChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="debtFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART.expenses} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={CHART.expenses} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={CHART.grid} vertical={false} />
                  <XAxis dataKey="label" {...axisProps} minTickGap={24} />
                  <YAxis {...axisProps} width={60} tickFormatter={(v: number) => formatMoneyCompact(v)} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="balance" name="Remaining debt" stroke={CHART.expenses} strokeWidth={2} fill="url(#debtFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Suggestions */}
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-medium">
              <Lightbulb size={15} className="text-accent" aria-hidden /> Suggestions
            </h3>
            <ul className="grid gap-3 md:grid-cols-2">
              {suggestions.map((s, i) => {
                const Icon = ICON[s.kind]
                return (
                  <li key={i} className="flex gap-3 rounded-xl border border-line bg-surface-2/60 p-3">
                    <Icon size={16} className={`mt-0.5 shrink-0 ${TONE[s.kind]}`} aria-hidden />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">{s.title}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{s.detail}</p>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>

          {/* Payoff order + per-debt inputs */}
          <div>
            <h3 className="mb-1 text-sm font-medium">Your debts</h3>
            <p className="mb-3 text-xs text-ink-faint">
              Interest rates and minimums for cards and loan accounts are estimates (36%/yr = 3%/month, minimum 3% or ₱500). Change them to your lender's actual numbers for an
              accurate plan.
            </p>
            <div className="relative overflow-x-auto rounded-xl border border-line">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="bg-surface-2 text-left text-xs text-ink-faint">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-medium">Debt</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Owed</th>
                    <th scope="col" className="px-3 py-2 font-medium">Interest %/yr</th>
                    <th scope="col" className="px-3 py-2 font-medium">Min / month</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Paid off</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {baseDebts.map((d) => {
                    const o = saved.overrides?.[d.id] ?? {}
                    const done = result.order.find((x) => x.id === d.id)
                    return (
                      <tr key={d.id}>
                        <td className="px-3 py-2">
                          {d.name}
                          {!d.aprKnown && o.apr === undefined && <span className="ml-1 text-[10px] text-ink-faint">(estimate)</span>}
                        </td>
                        <td className="tabular px-3 py-2 text-right">{formatMoney(d.balance)}</td>
                        <td className="px-3 py-2">
                          <input
                            aria-label={`Interest rate for ${d.name}`}
                            inputMode="decimal"
                            value={o.apr ?? String(d.defaultApr)}
                            onChange={(e) => setOverride(d.id, 'apr', e.target.value)}
                            className="tabular h-8 w-20 rounded-md border border-line bg-surface-2 px-2 text-sm focus:border-accent focus:outline-none"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            aria-label={`Minimum payment for ${d.name}`}
                            inputMode="decimal"
                            value={o.min ?? toMoneyInput(d.defaultMin)}
                            onChange={(e) => setOverride(d.id, 'min', e.target.value)}
                            className="tabular h-8 w-28 rounded-md border border-line bg-surface-2 px-2 text-sm focus:border-accent focus:outline-none"
                          />
                        </td>
                        <td className="px-3 py-2 text-right text-xs whitespace-nowrap text-ink-muted">{done ? addMonths(done.month) : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-[11px] text-ink-faint">
            Calculations and rule-based suggestions from the data you recorded — estimates, not guarantees or financial advice. Your lender's statement is authoritative.
          </p>
        </div>
      )}
    </Card>
  )
}
