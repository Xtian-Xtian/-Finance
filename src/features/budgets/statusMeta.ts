import type { BudgetStatus } from './types'

export const STATUS_META: Record<BudgetStatus, { label: string; tone: 'positive' | 'warning' | 'negative' }> = {
  safe: { label: 'Safe', tone: 'positive' },
  warning: { label: 'Warning', tone: 'warning' },
  exceeded: { label: 'Exceeded', tone: 'negative' },
}
