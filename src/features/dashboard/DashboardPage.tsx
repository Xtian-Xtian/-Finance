import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ChevronRight, Landmark, Plus } from 'lucide-react'
import { Button, Card, CardHeader, ConfirmDialog, EmptyState, Segmented } from '../../components/ui'
import { useFinance } from '../../data/FinanceDataProvider'
import { monthId, PERIOD_NOUN, shiftPeriod, startOfMonth, startOfPeriod, type Period } from '../../lib/dates'
import { formatMoney, percentChange, sum } from '../../lib/money'
import { accountTypeLabel, isLiability } from '../accounts/types'
import { useAuth } from '../auth/AuthProvider'
import { billStatus } from '../bills/billCalc'
import { budgetProgress } from '../budgets/budgetCalc'
import { liquidBalance } from '../networth/netWorthCalc'
import { useNetWorthHistory } from '../networth/useNetWorthHistory'
import { cashFlowSeries, incomeSources, spendingByCategory, totalsBetween } from '../transactions/transactionCalc'
import { TransactionDetail } from '../transactions/TransactionDetail'
import { TransactionForm } from '../transactions/TransactionForm'
import { TransactionTable } from '../transactions/TransactionTable'
import { deleteTransaction } from '../transactions/transactionService'
import { accountIdsOf, type Transaction } from '../transactions/types'
import { CardStack } from './CardStack'
import { AccountSummaryCard, CashFlowSummaryCard, ExpensesCard, IncomeOverviewCard, SpendingSummaryCard } from './widgets'

const PERIODS: Array<{ value: Period; label: string }> = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
]

function greeting(now: Date) {
  const h = now.getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

function periodLabel(period: Period, now: Date) {
  if (period === 'daily') return 'Today'
  if (period === 'weekly') return 'This week'
  if (period === 'yearly') return String(now.getFullYear())
  return now.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })
}

function ViewAll({ to }: { to: string }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink">
      View all <ChevronRight size={12} />
    </Link>
  )
}

export function DashboardPage() {
  const { uid, accounts, transactions, categories, budgets, bills, balances, netWorth } = useFinance()
  const { user } = useAuth()
  const [period, setPeriod] = useState<Period>('monthly')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Transaction | undefined>()
  const [viewingId, setViewingId] = useState<string | null>(null)
  const [cardId, setCardId] = useState<string | null>(null)
  const [showAllRecent, setShowAllRecent] = useState(false)
  const [deleting, setDeleting] = useState<Transaction | null>(null)
  const viewing = transactions.find((t) => t.id === viewingId) ?? null
  useNetWorthHistory() // keeps the monthly net-worth snapshot current; the chart is on Reports

  const now = new Date()
  const start = startOfPeriod(now, period)
  const end = shiftPeriod(start, period, 1)
  const prevStart = shiftPeriod(start, period, -1)

  const current = totalsBetween(transactions, start, end)
  const previous = totalsBetween(transactions, prevStart, start)
  const series = useMemo(() => cashFlowSeries(transactions, period), [transactions, period])
  const sources = incomeSources(transactions, categories, start, end, period)

  const thisMonth = monthId(now)
  const budgetRows = budgets.filter((b) => b.month === thisMonth).map((b) => budgetProgress(b, transactions)).sort((a, b) => b.percentUsed - a.percentUsed)
  const monthStart = startOfMonth(now)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const monthTotals = totalsBetween(transactions, monthStart, monthEnd)
  const unpaidBills = sum(bills.filter((b) => billStatus(b) !== 'paid').map((b) => b.amount))

  const cards = accounts.filter((a) => a.status === 'active')
  const selectedCard = cards.find((a) => a.id === cardId) ?? cards[0]
  const recent = (selectedCard && !showAllRecent ? transactions.filter((t) => accountIdsOf(t).includes(selectedCard.id)) : transactions).slice(0, 6)
  const firstName = (user?.displayName || user?.email?.split('@')[0] || '').split(' ')[0]

  // Alerts: calculations about the user's own data, not recommendations.
  const alerts: string[] = []
  const overdue = bills.filter((b) => billStatus(b) === 'overdue')
  if (overdue.length) alerts.push(`${overdue.length} bill${overdue.length > 1 ? 's are' : ' is'} overdue.`)
  const exceeded = budgetRows.filter((r) => r.status === 'exceeded')
  if (exceeded.length) {
    const name = categories.find((c) => c.id === exceeded[0].budget.categoryId)?.name ?? 'A category'
    alerts.push(`${name} spending is over budget this month${exceeded.length > 1 ? ` (+${exceeded.length - 1} more)` : ''}.`)
  }
  const lastMonthSameDay = totalsBetween(transactions, new Date(now.getFullYear(), now.getMonth() - 1, 1), new Date(now.getFullYear(), now.getMonth() - 1, now.getDate(), 23, 59)).expenses
  const expenseTrend = percentChange(totalsBetween(transactions, monthStart, now).expenses, lastMonthSameDay)
  if (expenseTrend != null && expenseTrend >= 15) alerts.push(`Spending is ${expenseTrend}% higher than at this point last month.`)

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl tracking-tight sm:text-4xl">
            <span className="font-light text-ink-muted">{greeting(now)}</span>
            {firstName && <span className="font-medium">, {firstName}</span>}
          </h1>
          <p className="mt-1.5 text-sm text-ink-faint">Your personal financial dashboard is ready.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented label="Summary period" value={period} onChange={setPeriod} options={PERIODS} />
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setFormOpen(true)}>
            Add transaction
          </Button>
        </div>
      </div>

      {alerts.length > 0 && (
        <div role="status" className="mb-4 flex items-start gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-sm">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden />
          <p className="text-ink-muted">
            <span className="font-medium text-ink">Heads up:</span> {alerts.join(' ')}
          </p>
        </div>
      )}

      {!accounts.length && (
        <div className="mb-4">
          <EmptyState
            icon={<Landmark size={28} />}
            title="Welcome! Start by adding an account"
            description="Add your bank, e-wallet, cash or credit card accounts, then record transactions to see your dashboard come alive."
            action={
              <Link to="/accounts">
                <Button variant="primary">Add an account</Button>
              </Link>
            }
          />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <AccountSummaryCard liquid={liquidBalance(netWorth)} netWorth={netWorth.netWorth} net={current.net} periodNoun={PERIOD_NOUN[period]} />
        <IncomeOverviewCard total={current.income} sources={sources} label={periodLabel(period, now)} />
        <ExpensesCard totals={current} series={series} periodNoun={PERIOD_NOUN[period]} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <CashFlowSummaryCard totals={current} unpaidBills={unpaidBills} netWorth={netWorth.netWorth} incomeChange={percentChange(current.income, previous.income)} series={series} />
        <SpendingSummaryCard
          budgets={budgetRows}
          topSpending={spendingByCategory(transactions, categories, monthStart, monthEnd)}
          income={monthTotals.income}
          expenses={monthTotals.expenses}
          trend={expenseTrend}
          now={now}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Transaction History"
            subtitle={selectedCard && !showAllRecent ? `${selectedCard.name} · ${accountTypeLabel(selectedCard.type)}` : 'All accounts'}
            action={
              <div className="flex items-center gap-3">
                {selectedCard && (
                  <button type="button" onClick={() => setShowAllRecent((v) => !v)} className="text-xs text-ink-muted hover:text-ink">
                    {showAllRecent ? `Only ${selectedCard.name}` : 'Show all'}
                  </button>
                )}
                <ViewAll to="/transactions" />
              </div>
            }
          />
          {recent.length ? (
            <TransactionTable transactions={recent} compact onView={(t) => setViewingId(t.id)} />
          ) : (
            <p className="text-sm text-ink-faint">{transactions.length ? 'No transactions for this account yet.' : 'No transactions yet.'}</p>
          )}
        </Card>

        <Card>
          <CardHeader title="My Cards" action={<ViewAll to="/accounts" />} />
          {selectedCard ? (
            <>
              <CardStack
                accounts={cards}
                balances={balances}
                selectedId={selectedCard.id}
                onSelect={(id) => {
                  setCardId(id)
                  setShowAllRecent(false)
                }}
              />
              <ul className="mt-4 divide-y divide-line">
                {cards.slice(0, 5).map((a) => {
                  const bal = balances.get(a.id) ?? a.openingBalance
                  return (
                    <li key={a.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <div className="min-w-0">
                        <p className="truncate">{a.name}</p>
                        <p className="text-xs text-ink-faint">{accountTypeLabel(a.type)}</p>
                      </div>
                      <span className={`tabular shrink-0 ${bal < 0 ? 'text-negative' : ''}`}>
                        {isLiability(a.type) ? (bal < 0 ? `-${formatMoney(-bal)}` : bal === 0 ? formatMoney(0) : `${formatMoney(bal)} overpaid`) : formatMoney(bal)}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </>
          ) : (
            <p className="text-sm text-ink-faint">No accounts yet.</p>
          )}
        </Card>
      </div>

      <TransactionForm
        open={formOpen}
        existing={editing}
        onClose={() => {
          setFormOpen(false)
          setEditing(undefined)
        }}
      />
      <TransactionDetail
        transaction={viewing}
        onClose={() => setViewingId(null)}
        onEdit={(t) => {
          setViewingId(null)
          setEditing(t)
          setFormOpen(true)
        }}
        onDelete={(t) => {
          setViewingId(null)
          setDeleting(t)
        }}
      />
      <ConfirmDialog
        open={!!deleting}
        title="Delete transaction?"
        message={deleting ? `"${deleting.description}" will be permanently removed.` : ''}
        onConfirm={() => deleteTransaction(uid, deleting!)}
        onClose={() => setDeleting(null)}
      />
    </>
  )
}
