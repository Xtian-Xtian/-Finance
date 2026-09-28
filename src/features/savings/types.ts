import type { Entity } from '../../lib/firestore'

export interface SavingsGoal extends Entity {
  name: string
  targetAmount: number
  /** Only changes together with a new SavingsContribution (enforced by rules). */
  currentAmount: number
  targetDate?: Date | null
  lastContributionId?: string
}

/** Append-only ledger. Negative amounts are withdrawals. */
export interface SavingsContribution extends Entity {
  goalId: string
  amount: number
  date: Date
  note?: string
}

export const SAVINGS_PRESETS = ['Emergency Fund', 'Travel', 'Motorcycle', 'Laptop', 'House', 'Education']
