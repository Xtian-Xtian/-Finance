import { addDays, addMonths, daysBetween } from '../../lib/dates'
import type { Bill, BillFrequency, BillStatus } from './types'

export function billStatus(bill: Pick<Bill, 'dueDate' | 'isPaid' | 'frequency'>, now = new Date()): BillStatus {
  if (bill.frequency === 'once' && bill.isPaid) return 'paid'
  const days = daysBetween(now, bill.dueDate)
  if (days < 0) return 'overdue'
  if (days === 0) return 'due_today'
  return 'upcoming'
}

export function nextDueDate(due: Date, frequency: BillFrequency): Date {
  switch (frequency) {
    case 'weekly':
      return addDays(due, 7)
    case 'monthly':
      return addMonths(due, 1)
    case 'quarterly':
      return addMonths(due, 3)
    case 'yearly':
      return addMonths(due, 12)
    case 'once':
      return due
  }
}

export function daysUntilDue(bill: Pick<Bill, 'dueDate'>, now = new Date()): number {
  return daysBetween(now, bill.dueDate)
}

const ORDER: Record<BillStatus, number> = { overdue: 0, due_today: 1, upcoming: 2, paid: 3 }

export function sortBills<T extends Bill>(bills: T[], now = new Date()): T[] {
  return [...bills].sort(
    (a, b) => ORDER[billStatus(a, now)] - ORDER[billStatus(b, now)] || a.dueDate.getTime() - b.dueDate.getTime(),
  )
}
