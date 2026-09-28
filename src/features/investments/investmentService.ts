import { getDocs, query, where } from 'firebase/firestore'
import { formatMoney } from '../../lib/money'
import { forCreate, forUpdate, newBatch, newId, userCol, userDoc, type Input } from '../../lib/firestore'
import { auditInBatch } from '../audit/auditService'
import type { Investment, InvestmentTransaction } from './types'

export type InvestmentInput = Input<Investment>

/** Creates a holding; its initial cost basis is recorded as a contribution in the same batch. */
export async function createInvestment(uid: string, input: InvestmentInput, initialContribution: number): Promise<string> {
  const id = newId(uid, 'investments')
  const batch = newBatch()
  batch.set(userDoc(uid, 'investments', id), forCreate(uid, input))
  if (initialContribution > 0) {
    batch.set(
      userDoc(uid, 'investmentTransactions', newId(uid, 'investmentTransactions')),
      forCreate(uid, { investmentId: id, kind: 'contribution', amount: initialContribution, date: new Date(), note: 'Initial purchase' }),
    )
  }
  auditInBatch(batch, uid, { action: 'investment.created', entityType: 'investment', entityId: id, details: input.name })
  await batch.commit()
  return id
}

export async function updateInvestment(uid: string, id: string, input: InvestmentInput): Promise<void> {
  const batch = newBatch()
  batch.update(userDoc(uid, 'investments', id), forUpdate(input))
  auditInBatch(batch, uid, { action: 'investment.updated', entityType: 'investment', entityId: id, details: `${input.name}: value ${formatMoney(input.currentValue)}` })
  await batch.commit()
}

export async function addInvestmentTransaction(
  uid: string,
  investment: Investment,
  input: Pick<InvestmentTransaction, 'kind' | 'amount' | 'date' | 'note'>,
): Promise<void> {
  const batch = newBatch()
  batch.set(
    userDoc(uid, 'investmentTransactions', newId(uid, 'investmentTransactions')),
    forCreate(uid, { investmentId: investment.id, ...input, note: input.note?.trim() || undefined }),
  )
  auditInBatch(batch, uid, {
    action: 'investment.transaction',
    entityType: 'investment',
    entityId: investment.id,
    details: `${input.kind} ${formatMoney(input.amount)} (${investment.name})`,
  })
  await batch.commit()
}

export async function deleteInvestment(uid: string, investment: Investment): Promise<void> {
  const txns = await getDocs(query(userCol(uid, 'investmentTransactions'), where('investmentId', '==', investment.id)))
  const batch = newBatch()
  txns.docs.slice(0, 450).forEach((d) => batch.delete(d.ref))
  batch.delete(userDoc(uid, 'investments', investment.id))
  auditInBatch(batch, uid, { action: 'investment.deleted', entityType: 'investment', entityId: investment.id, details: investment.name })
  await batch.commit()
}
