import { monthIdToDate } from '../../lib/dates'
import { percent } from '../../lib/money'
import type { Transaction } from '../transactions/types'
import type { Budget, BudgetStatus } from './types'

export const WARNING_THRESHOLD = 80 // percent

export interface BudgetProgress {
  budget: Budget
  spent: number
  remaining: number
  percentUsed: number
  status: BudgetStatus
}

export function budgetStatus(spent: number, limit: number): BudgetStatus {
  if (spent > limit) return 'exceeded'
  if (percent(spent, limit) >= WARNING_THRESHOLD) return 'warning'
  return 'safe'
}

/** Spent = expenses in the budget's category during the budget's month. */
export function budgetProgress(budget: Budget, transactions: Transaction[]): BudgetProgress {
  const from = monthIdToDate(budget.month)
  const to = new Date(from.getFullYear(), from.getMonth() + 1, 1)
  let spent = 0
  for (const t of transactions) {
    if (t.type === 'expense' && t.categoryId === budget.categoryId && t.date >= from && t.date < to) {
      spent += t.amount
    }
  }
  return {
    budget,
    spent,
    remaining: budget.limit - spent,
    percentUsed: percent(spent, budget.limit),
    status: budgetStatus(spent, budget.limit),
  }
}
