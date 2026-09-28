import { formatMoney } from '../../lib/money'
import { forCreate, forUpdate, newBatch, newId, userDoc, type Input } from '../../lib/firestore'
import { auditInBatch } from '../audit/auditService'
import { nextDueDate } from './billCalc'
import type { Bill } from './types'

export type BillInput = Omit<Input<Bill>, 'isPaid' | 'lastPaidAt'>

export async function createBill(uid: string, input: BillInput): Promise<string> {
  const id = newId(uid, 'bills')
  const batch = newBatch()
  batch.set(userDoc(uid, 'bills', id), forCreate(uid, { ...input, isPaid: false }))
  auditInBatch(batch, uid, { action: 'bill.created', entityType: 'bill', entityId: id, details: input.name })
  await batch.commit()
  return id
}

export async function updateBill(uid: string, id: string, input: BillInput): Promise<void> {
  const batch = newBatch()
  batch.update(userDoc(uid, 'bills', id), forUpdate(input))
  auditInBatch(batch, uid, { action: 'bill.updated', entityType: 'bill', entityId: id, details: input.name })
  await batch.commit()
}

export interface BillPayment {
  amount: number
  date: Date
  /** When set, an expense transaction is recorded in the same atomic batch. */
  accountId?: string
  categoryId?: string
}

/** Marks a bill paid: one-time bills become paid; recurring bills roll to the next due date. */
export async function markBillPaid(uid: string, bill: Bill, payment: BillPayment): Promise<void> {
  const batch = newBatch()
  if (payment.accountId && payment.categoryId) {
    batch.set(
      userDoc(uid, 'transactions', newId(uid, 'transactions')),
      forCreate(uid, {
        type: 'expense',
        amount: payment.amount,
        currency: 'PHP',
        accountId: payment.accountId,
        categoryId: payment.categoryId,
        description: `Bill: ${bill.name}`.slice(0, 120),
        date: payment.date,
      }),
    )
  }
  const recurring = bill.frequency !== 'once'
  batch.update(
    userDoc(uid, 'bills', bill.id),
    forUpdate({
      isPaid: !recurring,
      lastPaidAt: payment.date,
      dueDate: recurring ? nextDueDate(bill.dueDate, bill.frequency) : bill.dueDate,
    }),
  )
  auditInBatch(batch, uid, { action: 'bill.paid', entityType: 'bill', entityId: bill.id, details: `${bill.name}: ${formatMoney(payment.amount)}` })
  await batch.commit()
}

export async function deleteBill(uid: string, bill: Bill): Promise<void> {
  const batch = newBatch()
  batch.delete(userDoc(uid, 'bills', bill.id))
  auditInBatch(batch, uid, { action: 'bill.deleted', entityType: 'bill', entityId: bill.id, details: bill.name })
  await batch.commit()
}
