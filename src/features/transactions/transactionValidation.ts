// Application-layer validation for transactions. The UI shows these errors; the service
// re-runs them before writing; firestore.rules enforce the same constraints server-side.
import type { Errors } from '../../lib/validation'
import { optionalText, requireBusinessDate, requireMoney, requirePositiveMoney, requireText } from '../../lib/validation'
import type { Account } from '../accounts/types'
import type { Category } from '../categories/types'
import type { TransactionType } from './types'

export interface TransactionDraft {
  type: TransactionType
  amount: number | null
  accountId: string
  toAccountId: string
  categoryId: string
  description: string
  date: Date | null
  notes: string
}

export function validateTransaction(
  draft: TransactionDraft,
  accounts: Account[],
  categories: Category[],
): Errors {
  const errors: Errors = {}
  const ownsAccount = (id: string) => accounts.some((a) => a.id === id)

  errors.description = requireText(draft.description, 'Description', 120)
  errors.notes = optionalText(draft.notes, 'Notes', 500)
  errors.date = requireBusinessDate(draft.date)

  if (draft.type === 'adjustment') {
    errors.amount = requireMoney(draft.amount)
    if (!errors.amount && draft.amount === 0) errors.amount = 'Adjustment cannot be zero.'
  } else {
    errors.amount = requirePositiveMoney(draft.amount)
  }

  if (!ownsAccount(draft.accountId)) errors.accountId = 'Choose one of your accounts.'

  if (draft.type === 'transfer') {
    if (!ownsAccount(draft.toAccountId)) errors.toAccountId = 'Choose the destination account.'
    else if (draft.toAccountId === draft.accountId) errors.toAccountId = 'Choose a different account.'
  }

  if (draft.type === 'income' || draft.type === 'expense') {
    const category = categories.find((c) => c.id === draft.categoryId)
    if (!category) errors.categoryId = 'Choose a category.'
    else if (category.type !== draft.type) errors.categoryId = `Choose a ${draft.type} category.`
  }
  return errors
}
