import type { BillStatus } from './types'

export const BILL_STATUS_META: Record<BillStatus, { label: string; tone: 'positive' | 'negative' | 'warning' | 'neutral' }> = {
  paid: { label: 'Paid', tone: 'positive' },
  overdue: { label: 'Overdue', tone: 'negative' },
  due_today: { label: 'Due today', tone: 'warning' },
  upcoming: { label: 'Upcoming', tone: 'neutral' },
}
