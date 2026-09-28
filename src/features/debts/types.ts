import type { Entity } from '../../lib/firestore'

export type PaymentFrequency = 'weekly' | 'monthly' | 'quarterly' | 'yearly'

export interface Debt extends Entity {
  name: string
  lender?: string
  principal: number
  /** Only changes together with a new DebtPayment (enforced by rules). */
  outstandingBalance: number
  /** Annual interest in basis points (12.5% => 1250). */
  interestRate: number
  paymentAmount: number
  paymentFrequency: PaymentFrequency
  nextPaymentDate?: Date | null
  lastPaymentId?: string
}

/** Append-only ledger. outstandingBalance -= principalDelta. */
export interface DebtPayment extends Entity {
  debtId: string
  kind: 'payment' | 'adjustment'
  amount: number
  principalDelta: number
  date: Date
  note?: string
  /** Expense transaction created when the payment was paid from an account. */
  transactionId?: string
}

export const PAYMENT_FREQUENCIES: Array<{ value: PaymentFrequency; label: string }> = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
]

export function formatRate(basisPoints: number): string {
  return `${(basisPoints / 100).toFixed(2)}%`
}
