import { formatMoney } from '../../lib/money'
import { forCreate, forUpdate, newBatch, newId, userDoc } from '../../lib/firestore'
import { hasErrors } from '../../lib/validation'
import { auditInBatch } from '../audit/auditService'
import type { Account } from '../accounts/types'
import type { Category } from '../categories/types'
import type { Transaction } from './types'
import { validateTransaction, type TransactionDraft } from './transactionValidation'

export class ValidationError extends Error {}

/** Build the exact document fields for a draft; unused reference fields are omitted. */
export function toTransactionFields(draft: TransactionDraft): Record<string, unknown> {
  const base = {
    type: draft.type,
    amount: draft.amount,
    currency: 'PHP',
    description: draft.description.trim(),
    date: draft.date,
    notes: draft.notes.trim() || undefined,
    accountId: undefined as string | undefined,
    fromAccountId: undefined as string | undefined,
    toAccountId: undefined as string | undefined,
    categoryId: undefined as string | undefined,
  }
  if (draft.type === 'transfer') {
    base.fromAccountId = draft.accountId
    base.toAccountId = draft.toAccountId
  } else {
    base.accountId = draft.accountId
    if (draft.type !== 'adjustment') base.categoryId = draft.categoryId
  }
  return base
}

function describe(draft: TransactionDraft): string {
  return `${draft.type} ${formatMoney(draft.amount ?? 0)} — ${draft.description.trim()}`
}

/**
 * Create flow: validate → verify ownership (against the user's own loaded data; rules
 * re-verify server-side) → write transaction + audit atomically.
 */
export async function createTransaction(
  uid: string,
  draft: TransactionDraft,
  accounts: Account[],
  categories: Category[],
): Promise<string> {
  if (hasErrors(validateTransaction(draft, accounts, categories))) throw new ValidationError('Invalid transaction')
  const id = newId(uid, 'transactions')
  const batch = newBatch()
  batch.set(userDoc(uid, 'transactions', id), forCreate(uid, toTransactionFields(draft)))
  auditInBatch(batch, uid, { action: 'transaction.created', entityType: 'transaction', entityId: id, details: describe(draft) })
  await batch.commit()
  return id
}

export async function updateTransaction(
  uid: string,
  id: string,
  draft: TransactionDraft,
  accounts: Account[],
  categories: Category[],
): Promise<void> {
  if (hasErrors(validateTransaction(draft, accounts, categories))) throw new ValidationError('Invalid transaction')
  const batch = newBatch()
  batch.update(userDoc(uid, 'transactions', id), forUpdate(toTransactionFields(draft)))
  auditInBatch(batch, uid, { action: 'transaction.updated', entityType: 'transaction', entityId: id, details: describe(draft) })
  await batch.commit()
}

export async function deleteTransaction(uid: string, t: Transaction): Promise<void> {
  const batch = newBatch()
  batch.delete(userDoc(uid, 'transactions', t.id))
  auditInBatch(batch, uid, {
    action: 'transaction.deleted',
    entityType: 'transaction',
    entityId: t.id,
    details: `${t.type} ${formatMoney(t.amount)} — ${t.description}`,
  })
  await batch.commit()
}

export function draftFromTransaction(t: Transaction): TransactionDraft {
  return {
    type: t.type,
    amount: t.amount,
    accountId: t.type === 'transfer' ? t.fromAccountId : t.accountId,
    toAccountId: t.type === 'transfer' ? t.toAccountId : '',
    categoryId: t.type === 'income' || t.type === 'expense' ? t.categoryId : '',
    description: t.description,
    date: t.date,
    notes: t.notes ?? '',
  }
}
