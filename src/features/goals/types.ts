import type { Entity } from '../../lib/firestore'

export type FinancialGoalKind = 'net_worth' | 'debt_free' | 'savings_total' | 'custom'

export interface FinancialGoal extends Entity {
  name: string
  kind: FinancialGoalKind
  targetAmount: number
  /** Only used for custom goals; other kinds are measured automatically. */
  currentAmount?: number
  targetDate?: Date | null
  notes?: string
}

export const GOAL_KINDS: Array<{ value: FinancialGoalKind; label: string; hint: string }> = [
  { value: 'net_worth', label: 'Reach a net worth', hint: 'Tracked automatically from your net worth.' },
  { value: 'debt_free', label: 'Become debt-free', hint: 'Tracked from debts and liability accounts.' },
  { value: 'savings_total', label: 'Total savings', hint: 'Tracked from all savings goals combined.' },
  { value: 'custom', label: 'Custom', hint: 'Update progress manually.' },
]
