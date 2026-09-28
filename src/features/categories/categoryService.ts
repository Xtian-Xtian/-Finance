import { forCreate, forUpdate, newBatch, newId, userDoc, type Input } from '../../lib/firestore'
import { auditInBatch } from '../audit/auditService'
import type { Transaction } from '../transactions/types'
import type { Budget } from '../budgets/types'
import type { Category } from './types'
import { DEFAULT_CATEGORIES } from './types'

export type CategoryInput = Input<Category>

export async function createCategory(uid: string, input: CategoryInput): Promise<string> {
  const id = newId(uid, 'categories')
  const batch = newBatch()
  batch.set(userDoc(uid, 'categories', id), forCreate(uid, input))
  auditInBatch(batch, uid, { action: 'category.created', entityType: 'category', entityId: id, details: input.name })
  await batch.commit()
  return id
}

/** Category type is immutable (rules enforce it) so historical transactions stay consistent. */
export async function updateCategory(uid: string, id: string, input: Pick<Category, 'name' | 'color'>): Promise<void> {
  const batch = newBatch()
  batch.update(userDoc(uid, 'categories', id), forUpdate(input))
  auditInBatch(batch, uid, { action: 'category.updated', entityType: 'category', entityId: id, details: input.name })
  await batch.commit()
}

export function canDeleteCategory(categoryId: string, transactions: Transaction[], budgets: Budget[]): boolean {
  return (
    !transactions.some((t) => t.type !== 'transfer' && t.type !== 'adjustment' && t.categoryId === categoryId) &&
    !budgets.some((b) => b.categoryId === categoryId)
  )
}

export async function deleteCategory(uid: string, category: Category): Promise<void> {
  const batch = newBatch()
  batch.delete(userDoc(uid, 'categories', category.id))
  auditInBatch(batch, uid, { action: 'category.deleted', entityType: 'category', entityId: category.id, details: category.name })
  await batch.commit()
}

/** Adds the default category set into an existing batch (used when a profile is created). */
export function seedDefaultCategories(batch: ReturnType<typeof newBatch>, uid: string): void {
  for (const c of DEFAULT_CATEGORIES) {
    batch.set(userDoc(uid, 'categories', newId(uid, 'categories')), forCreate(uid, c))
  }
}
