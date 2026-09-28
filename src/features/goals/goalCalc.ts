import { percent } from '../../lib/money'
import type { NetWorthBreakdown } from '../networth/types'
import type { SavingsGoal } from '../savings/types'
import type { FinancialGoal } from './types'

export interface GoalProgress {
  current: number
  target: number
  percentage: number
  label: string
}

export function goalProgress(
  goal: FinancialGoal,
  netWorth: NetWorthBreakdown,
  savingsGoals: SavingsGoal[],
): GoalProgress {
  switch (goal.kind) {
    case 'net_worth': {
      const current = netWorth.netWorth
      return { current, target: goal.targetAmount, percentage: clamp(percent(current, goal.targetAmount)), label: 'Net worth' }
    }
    case 'debt_free': {
      // targetAmount = the liabilities you started with; progress = how much has been cleared.
      const remaining = netWorth.liabilities
      const cleared = Math.max(0, goal.targetAmount - remaining)
      const percentage = goal.targetAmount === 0 ? (remaining === 0 ? 100 : 0) : clamp(percent(cleared, goal.targetAmount))
      return { current: remaining, target: goal.targetAmount, percentage, label: 'Liabilities remaining' }
    }
    case 'savings_total': {
      const current = savingsGoals.reduce((s, g) => s + g.currentAmount, 0)
      return { current, target: goal.targetAmount, percentage: clamp(percent(current, goal.targetAmount)), label: 'Saved' }
    }
    case 'custom': {
      const current = goal.currentAmount ?? 0
      return { current, target: goal.targetAmount, percentage: clamp(percent(current, goal.targetAmount)), label: 'Progress' }
    }
  }
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n))
}
