import type { Entity } from '../../lib/firestore'

export type AccountType = 'cash' | 'bank' | 'ewallet' | 'credit_card' | 'investment' | 'loan'

export interface Account extends Entity {
  name: string
  type: AccountType
  institution?: string
  currency: 'PHP'
  /** Signed centavos. Liabilities (credit cards, loans) are negative when money is owed. */
  openingBalance: number
  status: 'active' | 'archived'
  // Credit-card-only fields. Never store full card numbers, CVV or PINs.
  lastFour?: string
  creditLimit?: number
  statementDay?: number
  dueDay?: number
}

export const ACCOUNT_TYPES: Array<{ value: AccountType; label: string }> = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank' },
  { value: 'ewallet', label: 'E-wallet' },
  { value: 'credit_card', label: 'Credit card' },
  { value: 'investment', label: 'Investment' },
  { value: 'loan', label: 'Loan' },
]

export const LIABILITY_TYPES: AccountType[] = ['credit_card', 'loan']

export function isLiability(type: AccountType): boolean {
  return LIABILITY_TYPES.includes(type)
}

export function accountTypeLabel(type: AccountType): string {
  return ACCOUNT_TYPES.find((t) => t.value === type)?.label ?? type
}
