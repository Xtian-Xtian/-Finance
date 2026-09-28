import { totalsBetween, type Totals } from '../transactions/transactionCalc'
import type { Transaction } from '../transactions/types'

export interface MonthRow extends Totals {
  month: number
  label: string
  /** Savings rate = net / income (calculation only). */
  savingsRate: number | null
}

export function yearlyReport(transactions: Transaction[], year: number): MonthRow[] {
  return Array.from({ length: 12 }, (_, m) => {
    const t = totalsBetween(transactions, new Date(year, m, 1), new Date(year, m + 1, 1))
    return {
      month: m,
      label: new Date(year, m, 1).toLocaleDateString('en-PH', { month: 'short' }),
      ...t,
      savingsRate: t.income > 0 ? Math.round((t.net / t.income) * 100) : null,
    }
  })
}

export function yearsWithData(transactions: Transaction[]): number[] {
  const years = new Set(transactions.map((t) => t.date.getFullYear()))
  years.add(new Date().getFullYear())
  return [...years].sort((a, b) => b - a)
}
