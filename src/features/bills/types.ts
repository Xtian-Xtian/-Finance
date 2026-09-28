import type { Entity } from '../../lib/firestore'

export type BillKind =
  | 'rent'
  | 'electricity'
  | 'water'
  | 'internet'
  | 'phone'
  | 'loan'
  | 'credit_card'
  | 'subscription'
  | 'other'

export type BillFrequency = 'once' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'

export interface Bill extends Entity {
  name: string
  kind: BillKind
  amount: number
  /** Next due date. Recurring bills advance this when marked paid. */
  dueDate: Date
  frequency: BillFrequency
  /** Only meaningful for one-time bills. */
  isPaid: boolean
  lastPaidAt?: Date | null
  /** Defaults used when recording the payment as an expense. */
  accountId?: string
  categoryId?: string
}

export type BillStatus = 'paid' | 'overdue' | 'due_today' | 'upcoming'

export const BILL_KINDS: Array<{ value: BillKind; label: string }> = [
  { value: 'rent', label: 'Rent' },
  { value: 'electricity', label: 'Electricity' },
  { value: 'water', label: 'Water' },
  { value: 'internet', label: 'Internet' },
  { value: 'phone', label: 'Phone' },
  { value: 'loan', label: 'Loan' },
  { value: 'credit_card', label: 'Credit card' },
  { value: 'subscription', label: 'Subscription' },
  { value: 'other', label: 'Other' },
]

export const BILL_FREQUENCIES: Array<{ value: BillFrequency; label: string }> = [
  { value: 'once', label: 'One-time' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
]
