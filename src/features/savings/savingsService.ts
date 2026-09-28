import { getDocs, query, where } from 'firebase/firestore'
import { formatMoney } from '../../lib/money'
import { forCreate, forUpdate, newBatch, newId, userCol, userDoc } from '../../lib/firestore'
import { auditInBatch } from '../audit/auditService'
import type { SavingsGoal } from './types'

export interface SavingsGoalInput {
  name: string
  targetAmount: number
  targetDate: Date | null
}

export async function createSavingsGoal(uid: string, input: SavingsGoalInput, startingAmount: number): Promise<string> {
  const id = newId(uid, 'savingsGoals')
  const batch = newBatch()
  if (startingAmount > 0) {
    // Goal + starting contribution are written atomically.
    const contributionId = newId(uid, 'savingsContributions')
    batch.set(
      userDoc(uid, 'savingsContributions', contributionId),
      forCreate(uid, { goalId: id, amount: startingAmount, date: new Date(), note: 'Starting balance' }),
    )
    batch.set(userDoc(uid, 'savingsGoals', id), forCreate(uid, { ...input, currentAmount: startingAmount, lastContributionId: contributionId }))
  } else {
    batch.set(userDoc(uid, 'savingsGoals', id), forCreate(uid, { ...input, currentAmount: 0 }))
  }
  auditInBatch(batch, uid, { action: 'savings.created', entityType: 'savingsGoal', entityId: id, details: input.name })
  await batch.commit()
  return id
}

/** Editing a goal never touches currentAmount — only contributions can. */
export async function updateSavingsGoal(uid: string, id: string, input: SavingsGoalInput): Promise<void> {
  const batch = newBatch()
  batch.update(userDoc(uid, 'savingsGoals', id), forUpdate(input))
  auditInBatch(batch, uid, { action: 'savings.updated', entityType: 'savingsGoal', entityId: id, details: input.name })
  await batch.commit()
}

/**
 * Atomic: contribution ledger entry + goal running total + audit in one batch.
 * Rules reject a goal total change that is not backed by a new contribution of equal amount.
 * Negative amount = withdrawal.
 */
export async function addContribution(
  uid: string,
  goal: Pick<SavingsGoal, 'id' | 'currentAmount' | 'name'>,
  amount: number,
  date: Date,
  note?: string,
): Promise<void> {
  const newTotal = goal.currentAmount + amount
  if (amount === 0 || newTotal < 0) throw new Error('Withdrawal cannot exceed the saved amount.')
  const contributionId = newId(uid, 'savingsContributions')
  const batch = newBatch()
  batch.set(userDoc(uid, 'savingsContributions', contributionId), forCreate(uid, { goalId: goal.id, amount, date, note: note?.trim() || undefined }))
  batch.update(userDoc(uid, 'savingsGoals', goal.id), forUpdate({ currentAmount: newTotal, lastContributionId: contributionId }))
  auditInBatch(batch, uid, {
    action: 'savings.contribution',
    entityType: 'savingsGoal',
    entityId: goal.id,
    details: `${amount > 0 ? 'Added' : 'Withdrew'} ${formatMoney(Math.abs(amount))} (${goal.name})`,
  })
  await batch.commit()
}

/** Deletes the goal together with its contribution history. */
export async function deleteSavingsGoal(uid: string, goal: SavingsGoal): Promise<void> {
  const contributions = await getDocs(query(userCol(uid, 'savingsContributions'), where('goalId', '==', goal.id)))
  const batch = newBatch()
  contributions.docs.slice(0, 450).forEach((d) => batch.delete(d.ref))
  batch.delete(userDoc(uid, 'savingsGoals', goal.id))
  auditInBatch(batch, uid, { action: 'savings.deleted', entityType: 'savingsGoal', entityId: goal.id, details: goal.name })
  await batch.commit()
}
