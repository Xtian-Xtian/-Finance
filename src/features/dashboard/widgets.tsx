// Dashboard widgets in the "Fundja" layout: summary, income, expenses, cash flow, spending.
import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, Landmark, PiggyBank, TrendingDown, TrendingUp, Zap } from 'lucide-react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Amount, Card, CardHeader, Chip } from '../../components/ui'
import { ChartTooltip } from '../../components/charts/ChartTooltip'
import { useChartTheme } from '../../components/charts/chartTheme'
import { formatMoney, formatMoneyCompact, percent } from '../../lib/money'
import type { BudgetProgress } from '../budgets/budgetCalc'
import type { CashFlowPoint, CategorySpend, IncomeSource, Totals } from '../transactions/transactionCalc'


function pct(n: number | null) {
  return n == null ? '—' : `${n > 0 ? '+' : ''}${n}%`
}

export function AccountSummaryCard({ liquid, netWorth, net, periodNoun }: { liquid: number; netWorth: number; net: number; periodNoun: string }) {
  return (
    <Card className="flex flex-col">
      <CardHeader title="Account Summary" subtitle="Cash, bank & e-wallets" />
      <p className="mt-auto text-xs text-ink-faint">Total Balance</p>
      <Amount centavos={liquid} className="mt-2 text-5xl sm:text-6xl" />
      <div className="mt-5 flex flex-wrap gap-2">
        <Chip icon={<TrendingUp size={12} aria-hidden />}>
          Net {periodNoun} <span className={net >= 0 ? 'text-accent' : 'text-negative'}>{net >= 0 ? '+' : ''}{formatMoney(net)}</span>
        </Chip>
        <Chip icon={<Landmark size={12} aria-hidden />}>
          Net worth <span className={netWorth >= 0 ? 'text-accent' : 'text-negative'}>{formatMoney(netWorth)}</span>
        </Chip>
      </div>
    </Card>
  )
}

export function IncomeOverviewCard({ total, sources, label }: { total: number; sources: IncomeSource[]; label: string }) {
  const CHART = useChartTheme()
  const SOURCE_COLORS = [CHART.savings, CHART.expenses, CHART.income]
  return (
    <Card className="flex flex-col">
      <CardHeader title="Income Overview" action={<span className="text-xs text-ink-faint">{label}</span>} />
      <p className="text-xs text-ink-faint">Total Income</p>
      <Amount centavos={total} className="mt-2 text-4xl sm:text-5xl" />
      {sources.length ? (
        <div className="mt-5 grid flex-1 grid-cols-3 gap-2">
          {sources.map((s, i) => {
            const color = SOURCE_COLORS[i % SOURCE_COLORS.length]
            return (
              <div key={s.categoryId} className="relative flex min-h-24 flex-col justify-between overflow-hidden rounded-lg border border-line bg-surface-2 p-2">
                <div className="relative min-w-0">
                  <span className="text-[11px] text-ink-muted">{s.share}%</span>
                  <p className="truncate text-[11px] text-ink-faint" title={s.name}>
                    {s.name}
                  </p>
                </div>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10" aria-hidden>
                  <ResponsiveContainer>
                    <AreaChart data={s.series.map((v, idx) => ({ idx, v }))} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id={`src-${i}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={color} stopOpacity={0.45} />
                          <stop offset="100%" stopColor={color} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill={`url(#src-${i})`} animationDuration={900} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <Amount centavos={s.amount} compactValue className="relative text-base [text-shadow:0_1px_3px_rgb(0_0_0/0.8)]" />
              </div>
            )
          })}
        </div>
      ) : (
        <p className="mt-5 text-sm text-ink-faint">No income recorded {label.toLowerCase()}.</p>
      )}
    </Card>
  )
}

export function ExpensesCard({ totals, series, periodNoun }: { totals: Totals; series: CashFlowPoint[]; periodNoun: string }) {
  const CHART = useChartTheme()
  const savingsRate = totals.income > 0 ? Math.round((totals.net / totals.income) * 100) : null
  const data = series.slice(-8)
  return (
    <Card className="flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Amount centavos={totals.expenses} className="text-4xl sm:text-5xl" />
          <p className="mt-2 text-xs text-ink-faint">Total Expenses {periodNoun}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <Chip icon={<PiggyBank size={12} aria-hidden />}>
            Saved <span className={totals.net >= 0 ? 'text-accent' : 'text-negative'}>{formatMoney(totals.net)}</span>
          </Chip>
          <Chip icon={<ArrowUpRight size={12} aria-hidden />}>
            Savings rate <span className="text-accent">{savingsRate == null ? '—' : `${savingsRate}%`}</span>
          </Chip>
        </div>
      </div>
      <div className="mt-4 h-28 min-h-28 flex-1" role="img" aria-label="Expenses per period">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <XAxis dataKey="label" stroke={CHART.axis} fontSize={10} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: '#ffffff08' }} />
            <Bar dataKey="expenses" name="Expenses" radius={[4, 4, 4, 4]}>
              {data.map((_, i) => (
                <Cell key={i} fill={i === data.length - 1 ? CHART.income : CHART.muted} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 flex items-center justify-between text-xs text-ink-faint">
        <span>Latest period highlighted</span>
        <span className="flex items-center gap-1">
          <Zap size={12} className="text-accent" aria-hidden /> {totals.income > 0 ? `${percent(totals.expenses, totals.income)}% of income spent` : 'No income yet'}
        </span>
      </p>
    </Card>
  )
}

interface CashFlowSummaryProps {
  totals: Totals
  unpaidBills: number
  netWorth: number
  incomeChange: number | null
  series: CashFlowPoint[]
}

/** Hover card for the cash-flow line: the period's net plus what made it up. */
function CashFlowTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: CashFlowPoint }> }) {
  const p = active ? payload?.[0]?.payload : undefined
  if (!p) return null
  return (
    <div className="glass-strong rounded-lg border border-line-strong px-3 py-2 text-xs">
      <p className="mb-1.5 font-medium text-ink uppercase">{p.label}</p>
      <p className={`tabular text-base font-semibold ${p.net < 0 ? 'text-negative' : 'text-accent'}`}>{formatMoney(p.net)}</p>
      <p className="mt-1 text-ink-faint">
        In {formatMoney(p.income)} · Out {formatMoney(p.expenses)}
      </p>
    </div>
  )
}

export function CashFlowSummaryCard({ totals, unpaidBills, netWorth, incomeChange, series }: CashFlowSummaryProps) {
  const CHART = useChartTheme()
  const axisProps = { stroke: CHART.axis, fontSize: 11, tickLine: false, axisLine: false } as const
  const figures = [
    { label: 'Income', value: totals.income },
    { label: 'Expenses', value: totals.expenses },
    { label: 'Net saved', value: totals.net },
    { label: 'Unpaid bills', value: unpaidBills },
    { label: 'Net worth', value: netWorth },
  ]
  const overspent = totals.expenses > totals.income
  const expenseRatio = totals.income > 0 ? Math.round((totals.expenses / totals.income) * 100) : null
  const savingsRate = totals.income > 0 ? Math.round((totals.net / totals.income) * 100) : null

  return (
    <Card className="flex flex-col lg:col-span-2">
      <CardHeader title="Cash Flow" subtitle="Transfers and balance adjustments are excluded" />
      <div className="grid grid-cols-2 gap-y-4 sm:grid-cols-5">
        {figures.map((f, i) => (
          <div key={f.label} className={i > 0 ? 'sm:border-l sm:border-line sm:pl-4' : ''}>
            <Amount centavos={f.value} compactValue className="text-2xl sm:text-3xl" />
            <p className="mt-1.5 text-xs text-ink-faint">{f.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Chip>
          Income vs last period <span className="text-accent">{pct(incomeChange)}</span>
        </Chip>
        <Chip>
          Expense ratio <span className={overspent ? 'text-negative' : 'text-ink'}>{expenseRatio == null ? '—' : `${expenseRatio}%`}</span>
        </Chip>
        <Chip>
          Savings rate <span className="text-accent">{savingsRate == null ? '—' : `${savingsRate}%`}</span>
        </Chip>
      </div>

      <div className="mt-4 h-56 w-full sm:h-64" role="img" aria-label="Net cash flow per period">
        <ResponsiveContainer>
          <AreaChart data={series} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="cashFlowFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART.income} stopOpacity={0.28} />
                <stop offset="100%" stopColor={CHART.income} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={CHART.grid} vertical={false} />
            <XAxis dataKey="label" {...axisProps} minTickGap={16} dy={6} />
            <YAxis {...axisProps} width={60} tickFormatter={(v: number) => formatMoneyCompact(v)} />
            <Tooltip content={<CashFlowTooltip />} cursor={{ stroke: CHART.income, strokeWidth: 1.5 }} />
            <Area
              type="monotone"
              dataKey="net"
              name="Net"
              stroke={CHART.income}
              strokeWidth={2}
              fill="url(#cashFlowFill)"
              activeDot={{ r: 6, fill: CHART.income, stroke: 'var(--color-surface)', strokeWidth: 3 }}
              animationDuration={1000}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

interface SpendingSummaryProps {
  budgets: BudgetProgress[]
  topSpending: CategorySpend[]
  income: number
  expenses: number
  /** % change vs the same point last month (null when there's nothing to compare). */
  trend: number | null
  now: Date
}

/** This month's spending: where it went, budget room left per category, and the month-end pace. */
export function SpendingSummaryCard({ budgets, topSpending, income, expenses, trend, now }: SpendingSummaryProps) {
  const byCategory = new Map(budgets.map((b) => [b.budget.categoryId, b]))
  const top = topSpending.slice(0, 4)
  const rest = topSpending.slice(4).reduce((t, c) => t + c.amount, 0)
  const rows = rest > 0 ? [...top, { categoryId: 'other', name: 'Other', color: '#71717a', amount: rest }] : top

  const day = now.getDate()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const dailyAvg = Math.round(expenses / day)
  const pace = dailyAvg * daysInMonth
  const spentOfIncome = income > 0 ? percent(expenses, income) : null
  const month = now.toLocaleDateString('en-PH', { month: 'long' })

  return (
    <Card className="flex flex-col">
      <CardHeader
        title="Spending Summary"
        subtitle={`${month} · day ${day} of ${daysInMonth}`}
        action={
          <Link to="/budgets" className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink">
            Budgets <ArrowRight size={12} />
          </Link>
        }
      />

      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs text-ink-faint">Spent this month</p>
          <Amount centavos={expenses} className="mt-1 text-4xl" />
        </div>
        {trend != null && (
          <Chip icon={trend > 0 ? <TrendingUp size={12} aria-hidden /> : <TrendingDown size={12} aria-hidden />}>
            <span className={trend > 0 ? 'text-negative' : 'text-accent'}>
              {trend > 0 ? '+' : ''}
              {trend}%
            </span>{' '}
            vs last month
          </Chip>
        )}
      </div>

      {rows.length ? (
        <>
          <div className="mt-4 flex h-2 w-full gap-0.5 overflow-hidden rounded-full" role="img" aria-label="Spending split by category">
            {rows.map((r, i) => (
              <div key={r.categoryId} className="grow-x h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${percent(r.amount, expenses)}%`, background: r.color, animationDelay: `${i * 80}ms` }} />
            ))}
          </div>
          <ul className="mt-4 space-y-3">
            {rows.map((r) => {
              const b = byCategory.get(r.categoryId)
              const share = percent(r.amount, expenses)
              const fill = b ? Math.min(100, b.percentUsed) : share
              const barColor = b?.status === 'exceeded' ? 'var(--color-negative)' : b?.status === 'warning' ? 'var(--color-amber)' : r.color
              return (
                <li key={r.categoryId}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="size-2 shrink-0 rounded-full" style={{ background: r.color }} aria-hidden />
                      <span className="truncate">{r.name}</span>
                    </span>
                    <span className="tabular shrink-0">
                      {formatMoney(r.amount)} <span className="text-xs text-ink-faint">{share}%</span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-surface-3" aria-hidden>
                    <div className="grow-x h-full rounded-full" style={{ width: `${fill}%`, background: barColor }} />
                  </div>
                  {b && (
                    <p className={`mt-1 text-[11px] ${b.remaining < 0 ? 'text-negative' : 'text-ink-faint'}`}>
                      {b.remaining < 0 ? `Over budget by ${formatMoney(-b.remaining)}` : `${formatMoney(b.remaining)} left of ${formatMoney(b.budget.limit)}`}
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
          {!budgets.length && (
            <Link to="/budgets" className="mt-3 inline-flex items-center gap-1 text-xs text-accent hover:underline">
              Set a budget to see how much room is left <ArrowRight size={12} />
            </Link>
          )}
        </>
      ) : (
        <p className="mt-4 text-sm text-ink-faint">No spending recorded in {month} yet.</p>
      )}

      <div className="mt-auto grid grid-cols-3 gap-3 border-t border-line pt-4 [&>div]:min-w-0">
        <div>
          <p className="tabular truncate text-sm font-medium">{formatMoney(dailyAvg)}</p>
          <p className="text-[11px] text-ink-faint">Daily average</p>
        </div>
        <div>
          <p className={`tabular truncate text-sm font-medium ${income > 0 && pace > income ? 'text-negative' : ''}`}>{formatMoney(pace)}</p>
          <p className="text-[11px] text-ink-faint">Month-end pace</p>
        </div>
        <div>
          <p className={`tabular text-sm font-medium ${spentOfIncome != null && spentOfIncome > 100 ? 'text-negative' : ''}`}>{spentOfIncome == null ? '—' : `${spentOfIncome}%`}</p>
          <p className="text-[11px] text-ink-faint">Of income spent</p>
        </div>
      </div>
    </Card>
  )
}
