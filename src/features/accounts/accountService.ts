import { forCreate, forUpdate, newBatch, newId, userDoc, type Input } from '../../lib/firestore'
import { auditInBatch } from '../audit/auditService'
import type { Transaction } from '../transactions/types'
import { accountIdsOf } from '../transactions/types'
import type { Account } from './types'

export type AccountInput = Input<Account>

export async function createAccount(uid: string, input: AccountInput): Promise<string> {
  const id = newId(uid, 'accounts')
  const batch = newBatch()
  batch.set(userDoc(uid, 'accounts', id), forCreate(uid, input))
  auditInBatch(batch, uid, { action: 'account.created', entityType: 'account', entityId: id, details: `${input.type}: ${input.name}` })
  await batch.commit()
  return id
}

export async function updateAccount(uid: string, id: string, input: AccountInput): Promise<void> {
  const batch = newBatch()
  batch.update(userDoc(uid, 'accounts', id), forUpdate(input))
  auditInBatch(batch, uid, { action: 'account.updated', entityType: 'account', entityId: id, details: input.name })
  await batch.commit()
}

/** Accounts referenced by transactions cannot be deleted (archive them instead). */
export function canDeleteAccount(accountId: string, transactions: Transaction[]): boolean {
  return !transactions.some((t) => accountIdsOf(t).includes(accountId))
}

export async function deleteAccount(uid: string, account: Account): Promise<void> {
  const batch = newBatch()
  batch.delete(userDoc(uid, 'accounts', account.id))
  auditInBatch(batch, uid, { action: 'account.deleted', entityType: 'account', entityId: account.id, details: account.name })
  await batch.commit()
}
