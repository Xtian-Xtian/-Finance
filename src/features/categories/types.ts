import type { Entity } from '../../lib/firestore'

export type CategoryType = 'income' | 'expense'

export interface Category extends Entity {
  name: string
  type: CategoryType
  color: string
}

export const DEFAULT_CATEGORIES: Array<Pick<Category, 'name' | 'type' | 'color'>> = [
  { name: 'Salary', type: 'income', color: '#2dd4bf' },
  { name: 'Business', type: 'income', color: '#22d3ee' },
  { name: 'Freelance', type: 'income', color: '#38bdf8' },
  { name: 'Interest & Dividends', type: 'income', color: '#a3e635' },
  { name: 'Other Income', type: 'income', color: '#94a3b8' },
  { name: 'Food', type: 'expense', color: '#f59e0b' },
  { name: 'Groceries', type: 'expense', color: '#fb923c' },
  { name: 'Transportation', type: 'expense', color: '#60a5fa' },
  { name: 'Bills & Utilities', type: 'expense', color: '#f472b6' },
  { name: 'Rent', type: 'expense', color: '#c084fc' },
  { name: 'Shopping', type: 'expense', color: '#818cf8' },
  { name: 'Health', type: 'expense', color: '#34d399' },
  { name: 'Education', type: 'expense', color: '#facc15' },
  { name: 'Entertainment', type: 'expense', color: '#fb7185' },
  { name: 'Subscriptions', type: 'expense', color: '#e879f9' },
  { name: 'Loan Payments', type: 'expense', color: '#f87171' },
  { name: 'Other Expense', type: 'expense', color: '#94a3b8' },
]
