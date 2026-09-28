import { getDoc } from 'firebase/firestore'
import { formatMoney } from '../../lib/money'
import { forCreate, forUpdate, newBatch, userDoc } from '../../lib/firestore'
import { auditInBatch } from '../audit/auditService'
import type { Budget } from './types'
import { budgetId } from './types'

/** Creates or updates the single budget for (month, category). */
export async function saveBudget(uid: string, month: string, categoryId: string, limit: number): Promise<void> {
  const id = budgetId(month, categoryId)
  const ref = userDoc(uid, 'budgets', id)
  const exists = (await getDoc(ref)).exists()
  const batch = newBatch()
  if (exists) batch.update(ref, forUpdate({ limit }))
  else batch.set(ref, forCreate(uid, { categoryId, month, limit }))
  auditInBatch(batch, uid, {
    action: exists ? 'budget.updated' : 'budget.created',
    entityType: 'budget',
    entityId: id,
    details: `${month}: ${formatMoney(limit)}`,
  })
  await batch.commit()
}

export async function deleteBudget(uid: string, budget: Budget): Promise<void> {
  const batch = newBatch()
  batch.delete(userDoc(uid, 'budgets', budget.id))
  auditInBatch(batch, uid, { action: 'budget.deleted', entityType: 'budget', entityId: budget.id, details: budget.month })
  await batch.commit()
}

/** Copies all budgets from one month into another (skips categories that already exist). */
export async function copyBudgets(uid: string, from: Budget[], toMonth: string, existing: Budget[]): Promise<number> {
  const taken = new Set(existing.filter((b) => b.month === toMonth).map((b) => b.categoryId))
  const toCopy = from.filter((b) => !taken.has(b.categoryId))
  if (!toCopy.length) return 0
  const batch = newBatch()
  for (const b of toCopy) {
    batch.set(userDoc(uid, 'budgets', budgetId(toMonth, b.categoryId)), forCreate(uid, { categoryId: b.categoryId, month: toMonth, limit: b.limit }))
  }
  auditInBatch(batch, uid, { action: 'budget.created', entityType: 'budget', details: `Copied ${toCopy.length} budgets to ${toMonth}` })
  await batch.commit()
  return toCopy.length
}
