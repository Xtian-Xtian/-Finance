import { shiftPeriod, startOfPeriod, periodLabel, type Period } from '../../lib/dates'
import type { Category } from '../categories/types'
import type { Transaction } from './types'

export interface Totals {
  income: number
  expenses: number
  /** income − expenses for the range (a calculation, not a recommendation). */
  net: number
}

/** Income and expense totals in [from, to). Transfers and adjustments are excluded. */
export function totalsBetween(transactions: Transaction[], from: Date, to: Date): Totals {
  let income = 0
  let expenses = 0
  for (const t of transactions) {
    if (t.date < from || t.date >= to) continue
    if (t.type === 'income') income += t.amount
    else if (t.type === 'expense') expenses += t.amount
  }
  return { income, expenses, net: income - expenses }
}

export interface CashFlowPoint extends Totals {
  label: string
  start: Date
}

const BUCKETS: Record<Period, number> = { daily: 14, weekly: 12, monthly: 12, yearly: 5 }

/** Cash-flow series ending in the current period. */
export function cashFlowSeries(transactions: Transaction[], period: Period, now = new Date()): CashFlowPoint[] {
  const current = startOfPeriod(now, period)
  const count = BUCKETS[period]
  const points: CashFlowPoint[] = []
  for (let i = count - 1; i >= 0; i--) {
    const start = shiftPeriod(current, period, -i)
    const end = shiftPeriod(start, period, 1)
    points.push({ label: periodLabel(start, period), start, ...totalsBetween(transactions, start, end) })
  }
  return points
}

export interface CategorySpend {
  categoryId: string
  name: string
  color: string
  amount: number
}

/** Expense totals per category in [from, to), largest first. */
export function spendingByCategory(
  transactions: Transaction[],
  categories: Category[],
  from: Date,
  to: Date,
): CategorySpend[] {
  const byId = new Map(categories.map((c) => [c.id, c]))
  const totals = new Map<string, number>()
  for (const t of transactions) {
    if (t.type !== 'expense' || t.date < from || t.date >= to) continue
    totals.set(t.categoryId, (totals.get(t.categoryId) ?? 0) + t.amount)
  }
  return [...totals.entries()]
    .map(([categoryId, amount]) => ({
      categoryId,
      amount,
      name: byId.get(categoryId)?.name ?? 'Uncategorised',
      color: byId.get(categoryId)?.color ?? '#64748b',
    }))
    .sort((a, b) => b.amount - a.amount)
}

export interface IncomeSource {
  categoryId: string
  name: string
  color: string
  amount: number
  /** Share of total income in the range, 0-100. */
  share: number
  /** Income per period bucket (same buckets as cashFlowSeries), for sparklines. */
  series: number[]
}

/** Top income categories in [from, to) with a per-period history for sparklines. */
export function incomeSources(
  transactions: Transaction[],
  categories: Category[],
  from: Date,
  to: Date,
  period: Period,
  limit = 3,
  now = new Date(),
): IncomeSource[] {
  const byId = new Map(categories.map((c) => [c.id, c]))
  const totals = new Map<string, number>()
  let total = 0
  for (const t of transactions) {
    if (t.type !== 'income' || t.date < from || t.date >= to) continue
    totals.set(t.categoryId, (totals.get(t.categoryId) ?? 0) + t.amount)
    total += t.amount
  }
  const current = startOfPeriod(now, period)
  const starts = Array.from({ length: BUCKETS[period] }, (_, i) => shiftPeriod(current, period, i - BUCKETS[period] + 1))
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([categoryId, amount]) => ({
      categoryId,
      amount,
      name: byId.get(categoryId)?.name ?? 'Other income',
      color: byId.get(categoryId)?.color ?? '#64748b',
      share: total ? Math.round((amount / total) * 100) : 0,
      series: starts.map((s) => {
        const e = shiftPeriod(s, period, 1)
        let sum = 0
        for (const t of transactions) if (t.type === 'income' && t.categoryId === categoryId && t.date >= s && t.date < e) sum += t.amount
        return sum
      }),
    }))
}
