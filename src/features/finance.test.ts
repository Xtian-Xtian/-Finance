import { describe, expect, it } from 'vitest'
import { computeBalances, targetBalance } from './accounts/accountCalc'
import type { Account } from './accounts/types'
import { billStatus, nextDueDate } from './bills/billCalc'
import { budgetProgress, budgetStatus } from './budgets/budgetCalc'
import type { Budget } from './budgets/types'
import { estimatePayoff } from './debts/debtCalc'
import type { Debt } from './debts/types'
import { investmentPerformance } from './investments/investmentCalc'
import type { Investment, InvestmentTransaction } from './investments/types'
import { netWorthBreakdown } from './networth/netWorthCalc'
import { savingsProgress } from './savings/savingsCalc'
import type { SavingsGoal } from './savings/types'
import { totalsBetween } from './transactions/transactionCalc'
import type { Transaction } from './transactions/types'
import { validateTransaction } from './transactions/transactionValidation'
import type { Category } from './categories/types'

const meta = { ownerId: 'u1', createdAt: new Date(), updatedAt: new Date() }

function account(id: string, type: Account['type'], openingBalance: number): Account {
  return { id, ...meta, name: id, type, currency: 'PHP', openingBalance, status: 'active' }
}

const d = (s: string) => new Date(`${s}T12:00:00`)

const accounts = [account('bpi', 'bank', 2_000_000), account('gcash', 'ewallet', 0), account('card', 'credit_card', -500_000)]

const txns: Transaction[] = [
  { id: 't1', ...meta, type: 'income', amount: 5_000_000, currency: 'PHP', accountId: 'bpi', categoryId: 'salary', description: 'Salary', date: d('2026-06-15') },
  { id: 't2', ...meta, type: 'expense', amount: 150_050, currency: 'PHP', accountId: 'gcash', categoryId: 'food', description: 'Groceries', date: d('2026-06-16') },
  { id: 't3', ...meta, type: 'transfer', amount: 500_000, currency: 'PHP', fromAccountId: 'bpi', toAccountId: 'gcash', description: 'Top up', date: d('2026-06-10') },
  { id: 't4', ...meta, type: 'expense', amount: 200_000, currency: 'PHP', accountId: 'card', categoryId: 'food', description: 'Dinner', date: d('2026-06-20') },
  { id: 't5', ...meta, type: 'adjustment', amount: -1_000, currency: 'PHP', accountId: 'bpi', description: 'Bank fee correction', date: d('2026-06-21') },
]

describe('account balances', () => {
  it('derives balances from opening balance and transactions', () => {
    const b = computeBalances(accounts, txns)
    expect(b.get('bpi')).toBe(2_000_000 + 5_000_000 - 500_000 - 1_000)
    expect(b.get('gcash')).toBe(500_000 - 150_050)
    expect(b.get('card')).toBe(-700_000)
  })

  it('supports as-of dates', () => {
    expect(computeBalances(accounts, txns, d('2026-06-12')).get('bpi')).toBe(1_500_000)
  })

  it('transfers do not change net worth', () => {
    const before = netWorthBreakdown(accounts, computeBalances(accounts, []), [], []).netWorth
    const after = netWorthBreakdown(accounts, computeBalances(accounts, [txns[2]]), [], []).netWorth
    expect(after).toBe(before)
  })
})

describe('income / expense totals', () => {
  it('excludes transfers and adjustments', () => {
    const t = totalsBetween(txns, d('2026-06-01'), d('2026-07-01'))
    expect(t).toEqual({ income: 5_000_000, expenses: 350_050, net: 4_649_950 })
  })
})

describe('net worth', () => {
  it('is assets minus liabilities incl. investments and debts', () => {
    const inv = [{ id: 'i', ...meta, name: 'Fund', assetType: 'fund', quantity: 1, purchasePrice: 0, currentValue: 1_000_000 } as Investment]
    const debt = [{ id: 'd', ...meta, name: 'Loan', principal: 3_000_000, outstandingBalance: 2_000_000, interestRate: 0, paymentAmount: 0, paymentFrequency: 'monthly' } as Debt]
    const b = netWorthBreakdown(accounts, computeBalances(accounts, txns), inv, debt)
    expect(b.creditCards).toBe(700_000)
    expect(b.liabilities).toBe(700_000 + 2_000_000)
    expect(b.netWorth).toBe(b.assets - b.liabilities)
  })
})

describe('budgets', () => {
  it('computes spent, remaining and status for the month', () => {
    const budget: Budget = { id: '2026-06_food', ...meta, categoryId: 'food', month: '2026-06', limit: 400_000 }
    const p = budgetProgress(budget, txns)
    expect(p.spent).toBe(350_050)
    expect(p.remaining).toBe(49_950)
    expect(p.status).toBe('warning')
  })
  it('status thresholds', () => {
    expect(budgetStatus(100, 1000)).toBe('safe')
    expect(budgetStatus(800, 1000)).toBe('warning')
    expect(budgetStatus(1001, 1000)).toBe('exceeded')
  })
})

describe('bills', () => {
  const now = d('2026-06-15')
  it('classifies status', () => {
    expect(billStatus({ dueDate: d('2026-06-10'), isPaid: false, frequency: 'monthly' }, now)).toBe('overdue')
    expect(billStatus({ dueDate: d('2026-06-15'), isPaid: false, frequency: 'monthly' }, now)).toBe('due_today')
    expect(billStatus({ dueDate: d('2026-06-20'), isPaid: false, frequency: 'monthly' }, now)).toBe('upcoming')
    expect(billStatus({ dueDate: d('2026-06-10'), isPaid: true, frequency: 'once' }, now)).toBe('paid')
  })
  it('advances recurring due dates, clamping month ends', () => {
    expect(nextDueDate(d('2026-01-31'), 'monthly').getDate()).toBe(28)
    expect(nextDueDate(d('2026-06-15'), 'yearly').getFullYear()).toBe(2027)
  })
})

describe('savings', () => {
  it('computes remaining and required monthly contribution', () => {
    const goal: SavingsGoal = { id: 'g', ...meta, name: 'Laptop', targetAmount: 6_000_000, currentAmount: 1_200_000, targetDate: d('2026-12-15') }
    const p = savingsProgress(goal, d('2026-06-15'))
    expect(p.remaining).toBe(4_800_000)
    expect(p.percentage).toBe(20)
    expect(p.requiredMonthly).toBe(800_000)
  })
})

describe('debts', () => {
  it('estimates payoff and detects payments that never cover interest', () => {
    expect(estimatePayoff({ outstandingBalance: 1_200_000, interestRate: 0, paymentAmount: 100_000, paymentFrequency: 'monthly' }).payments).toBe(12)
    expect(estimatePayoff({ outstandingBalance: 10_000_000, interestRate: 2400, paymentAmount: 100_000, paymentFrequency: 'monthly' }).payments).toBeNull()
  })
})

describe('investments', () => {
  it('computes gain against net invested', () => {
    const inv = { id: 'i', ...meta, name: 'Fund', assetType: 'fund', quantity: 10, purchasePrice: 100_000, currentValue: 1_200_000 } as Investment
    const tx = [
      { id: 'a', ...meta, investmentId: 'i', kind: 'contribution', amount: 1_000_000, date: new Date() },
      { id: 'b', ...meta, investmentId: 'i', kind: 'withdrawal', amount: 100_000, date: new Date() },
    ] as InvestmentTransaction[]
    const p = investmentPerformance(inv, tx)
    expect(p.netInvested).toBe(900_000)
    expect(p.gain).toBe(300_000)
  })
})

describe('transaction validation (application layer)', () => {
  const cats: Category[] = [
    { id: 'food', ...meta, name: 'Food', type: 'expense', color: '#ffffff' },
    { id: 'salary', ...meta, name: 'Salary', type: 'income', color: '#ffffff' },
  ]
  const base = { type: 'expense' as const, amount: 100, accountId: 'bpi', toAccountId: '', categoryId: 'food', description: 'x', date: new Date(), notes: '' }

  it('accepts a valid expense', () => {
    expect(Object.values(validateTransaction(base, accounts, cats)).filter(Boolean)).toHaveLength(0)
  })
  it('rejects accounts the user does not own', () => {
    expect(validateTransaction({ ...base, accountId: 'someone-elses' }, accounts, cats).accountId).toBeTruthy()
  })
  it('rejects mismatched category type', () => {
    expect(validateTransaction({ ...base, categoryId: 'salary' }, accounts, cats).categoryId).toBeTruthy()
  })
  it('rejects transfers to the same account', () => {
    expect(validateTransaction({ ...base, type: 'transfer', toAccountId: 'bpi' }, accounts, cats).toAccountId).toBeTruthy()
  })
  it('rejects zero / negative amounts', () => {
    expect(validateTransaction({ ...base, amount: 0 }, accounts, cats).amount).toBeTruthy()
    expect(validateTransaction({ ...base, amount: -5 }, accounts, cats).amount).toBeTruthy()
  })
})

describe('update balance (reconcile)', () => {
  it('uses the balance directly for assets', () => {
    expect(targetBalance({ type: 'bank' }, { mode: 'balance', amount: 3430 })).toBe(3430)
  })
  it('turns amount owed into a negative liability balance', () => {
    expect(targetBalance({ type: 'credit_card', creditLimit: 500_000 }, { mode: 'owed', amount: 1423 })).toBe(-1423)
  })
  it('derives owed from limit minus available', () => {
    expect(targetBalance({ type: 'loan', creditLimit: 1_100_000 }, { mode: 'available', amount: 490_000 })).toBe(-610_000)
  })
})
