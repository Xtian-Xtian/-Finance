import { forCreate, forUpdate, newBatch, newId, userDoc, type Input } from '../../lib/firestore'
import { auditInBatch } from '../audit/auditService'
import type { FinancialGoal } from './types'

export type FinancialGoalInput = Input<FinancialGoal>

export async function createGoal(uid: string, input: FinancialGoalInput): Promise<string> {
  const id = newId(uid, 'financialGoals')
  const batch = newBatch()
  batch.set(userDoc(uid, 'financialGoals', id), forCreate(uid, input))
  auditInBatch(batch, uid, { action: 'goal.created', entityType: 'financialGoal', entityId: id, details: input.name })
  await batch.commit()
  return id
}

export async function updateGoal(uid: string, id: string, input: FinancialGoalInput): Promise<void> {
  const batch = newBatch()
  batch.update(userDoc(uid, 'financialGoals', id), forUpdate(input))
  auditInBatch(batch, uid, { action: 'goal.updated', entityType: 'financialGoal', entityId: id, details: input.name })
  await batch.commit()
}

export async function deleteGoal(uid: string, goal: FinancialGoal): Promise<void> {
  const batch = newBatch()
  batch.delete(userDoc(uid, 'financialGoals', goal.id))
  auditInBatch(batch, uid, { action: 'goal.deleted', entityType: 'financialGoal', entityId: goal.id, details: goal.name })
  await batch.commit()
}
