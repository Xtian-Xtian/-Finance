// Builds the compact financial summary sent to the AI coach. It deliberately contains only
// aggregates (balances, debts, monthly totals, category totals) — no transaction
// descriptions, notes, card digits or account numbers.
import { monthId } from '../../lib/dates'
import { isLiability, type Account } from '../accounts/types'
import { billStatus } from '../bills/billCalc'
import type { Bill } from '../bills/types'
import type { Category } from '../categories/types'
import type { Debt } from '../debts/types'
import type { FinancialGoal } from '../goals/types'
import type { NetWorthBreakdown } from '../networth/types'
import type { SavingsGoal } from '../savings/types'
import { spendingByCategory, totalsBetween } from '../transactions/transactionCalc'
import type { Transaction } from '../transactions/types'

const php = (centavos: number) => Math.round(centavos) / 100

export interface CoachInput {
  accounts: Account[]
  balances: Map<string, number>
  transactions: Transaction[]
  categories: Category[]
  debts: Debt[]
  bills: Bill[]
  savingsGoals: SavingsGoal[]
  financialGoals: FinancialGoal[]
  netWorth: NetWorthBreakdown
}

export function buildCoachSummary(d: CoachInput, now = new Date()) {
  const months = [3, 2, 1, 0].map((back) => {
    const start = new Date(now.getFullYear(), now.getMonth() - back, 1)
    const end = new Date(now.getFullYear(), now.getMonth() - back + 1, 1)
    const t = totalsBetween(d.transactions, start, end)
    return { month: monthId(start), incomePhp: php(t.income), expensesPhp: php(t.expenses), partial: back === 0 }
  })
  const complete = months.filter((m) => !m.partial && (m.incomePhp || m.expensesPhp))
  const avg = (key: 'incomePhp' | 'expensesPhp') =>
    complete.length ? Math.round((complete.reduce((s, m) => s + m[key], 0) / complete.length) * 100) / 100 : null

  const active = d.accounts.filter((a) => a.status === 'active')
  const balance = (a: Account) => d.balances.get(a.id) ?? a.openingBalance
  const last30 = new Date(now.getTime() - 30 * 86_400_000)

  return {
    currency: 'PHP',
    today: now.toISOString().slice(0, 10),
    netWorthPhp: php(d.netWorth.netWorth),
    assetsPhp: php(d.netWorth.assets),
    liabilitiesPhp: php(d.netWorth.liabilities),
    assetAccounts: active
      .filter((a) => !isLiability(a.type))
      .map((a) => ({ name: a.name, type: a.type, balancePhp: php(balance(a)) })),
    creditLinesAndLoans: active
      .filter((a) => isLiability(a.type))
      .map((a) => ({
        name: a.name,
        type: a.type,
        owedPhp: php(Math.max(0, -balance(a))),
        limitPhp: a.creditLimit != null ? php(a.creditLimit) : null,
        paymentDueDay: a.dueDay ?? null,
        interestRate: 'unknown',
      })),
    debts: d.debts.map((x) => ({
      name: x.name,
      outstandingPhp: php(x.outstandingBalance),
      annualInterestPct: x.interestRate / 100,
      scheduledPaymentPhp: php(x.paymentAmount),
      paymentFrequency: x.paymentFrequency,
      nextPaymentDate: x.nextPaymentDate ? x.nextPaymentDate.toISOString().slice(0, 10) : null,
    })),
    monthlyCashFlow: months,
    averageMonthlyIncomePhp: avg('incomePhp'),
    averageMonthlyExpensesPhp: avg('expensesPhp'),
    spendingLast30DaysByCategory: spendingByCategory(d.transactions, d.categories, last30, now)
      .slice(0, 8)
      .map((c) => ({ category: c.name, amountPhp: php(c.amount) })),
    unpaidBills: d.bills
      .filter((b) => billStatus(b, now) !== 'paid')
      .slice(0, 12)
      .map((b) => ({ name: b.name, amountPhp: php(b.amount), dueDate: b.dueDate.toISOString().slice(0, 10), frequency: b.frequency, status: billStatus(b, now) })),
    savingsGoals: d.savingsGoals.map((g) => ({ name: g.name, savedPhp: php(g.currentAmount), targetPhp: php(g.targetAmount) })),
    financialGoals: d.financialGoals.map((g) => ({
      name: g.name,
      kind: g.kind,
      targetPhp: php(g.targetAmount),
      targetDate: g.targetDate ? g.targetDate.toISOString().slice(0, 10) : null,
    })),
    dataNote: 'Balances are what the user recorded; some spending may not be tracked. Credit line / loan interest rates are unknown unless listed under debts.',
  }
}

export type CoachSummary = ReturnType<typeof buildCoachSummary>
