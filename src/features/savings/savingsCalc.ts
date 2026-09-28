import { percent } from '../../lib/money'
import type { SavingsGoal } from './types'

export interface SavingsProgress {
  remaining: number
  percentage: number
  monthsLeft: number | null
  /** Required monthly contribution to hit the target date — a calculation, not advice. */
  requiredMonthly: number | null
}

export function monthsUntil(target: Date, now = new Date()): number {
  const months = (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth())
  return Math.max(0, months + (target.getDate() >= now.getDate() ? 0 : -1))
}

export function savingsProgress(goal: SavingsGoal, now = new Date()): SavingsProgress {
  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount)
  const percentage = Math.min(100, percent(goal.currentAmount, goal.targetAmount))
  if (!goal.targetDate) return { remaining, percentage, monthsLeft: null, requiredMonthly: null }
  const monthsLeft = monthsUntil(goal.targetDate, now)
  const requiredMonthly = remaining === 0 ? 0 : Math.ceil(remaining / Math.max(1, monthsLeft))
  return { remaining, percentage, monthsLeft, requiredMonthly }
}
