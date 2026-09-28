import type { Entity } from '../../lib/firestore'

export type TransactionType = 'income' | 'expense' | 'transfer' | 'adjustment'

interface TransactionBase extends Entity {
  /** Integer centavos. Positive, except adjustments which are signed. */
  amount: number
  currency: 'PHP'
  description: string
  date: Date
  notes?: string
  /** Set when created by the Gmail auto-import script. */
  source?: 'gmail'
}

export interface IncomeExpenseTransaction extends TransactionBase {
  type: 'income' | 'expense'
  accountId: string
  categoryId: string
}

/** A transfer is ONE document, so both sides are always recorded atomically. */
export interface TransferTransaction extends TransactionBase {
  type: 'transfer'
  fromAccountId: string
  toAccountId: string
}

export interface AdjustmentTransaction extends TransactionBase {
  type: 'adjustment'
  accountId: string
}

export type Transaction = IncomeExpenseTransaction | TransferTransaction | AdjustmentTransaction

export const TRANSACTION_TYPES: Array<{ value: TransactionType; label: string }> = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'adjustment', label: 'Balance adjustment' },
]

/** Accounts touched by a transaction (for ownership checks, filtering and deletes). */
export function accountIdsOf(t: Transaction): string[] {
  return t.type === 'transfer' ? [t.fromAccountId, t.toAccountId] : [t.accountId]
}
