import type { Entity } from '../../lib/firestore'

export interface Budget extends Entity {
  categoryId: string
  /** "YYYY-MM" */
  month: string
  /** Centavos */
  limit: number
}

export type BudgetStatus = 'safe' | 'warning' | 'exceeded'

/** Budgets use a deterministic id so there is exactly one per category per month. */
export function budgetId(month: string, categoryId: string): string {
  return `${month}_${categoryId}`
}
