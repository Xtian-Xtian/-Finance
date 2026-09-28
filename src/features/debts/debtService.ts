import { getDocs, query, where } from 'firebase/firestore'
import { formatMoney } from '../../lib/money'
import { forCreate, forUpdate, newBatch, newId, userCol, userDoc, type Input } from '../../lib/firestore'
import { auditInBatch } from '../audit/auditService'
import { nextDueDate } from '../bills/billCalc'
import type { Debt } from './types'

export type DebtInput = Omit<Input<Debt>, 'outstandingBalance' | 'lastPaymentId'>

export async function createDebt(uid: string, input: DebtInput, outstandingBalance: number): Promise<string> {
  const id = newId(uid, 'debts')
  const batch = newBatch()
  batch.set(userDoc(uid, 'debts', id), forCreate(uid, { ...input, outstandingBalance }))
  auditInBatch(batch, uid, { action: 'debt.created', entityType: 'debt', entityId: id, details: `${input.name}: ${formatMoney(outstandingBalance)}` })
  await batch.commit()
  return id
}

/** Editing terms never changes the outstanding balance — only payments/adjustments can. */
export async function updateDebt(uid: string, id: string, input: DebtInput): Promise<void> {
  const batch = newBatch()
  batch.update(userDoc(uid, 'debts', id), forUpdate(input))
  auditInBatch(batch, uid, { action: 'debt.updated', entityType: 'debt', entityId: id, details: input.name })
  await batch.commit()
}

export interface DebtPaymentInput {
  kind: 'payment' | 'adjustment'
  /** Payment: positive. Adjustment: positive reduces the balance, negative adds charges/interest. */
  amount: number
  date: Date
  note?: string
  /** Payments only: record as an expense from this account in the same batch. */
  accountId?: string
  categoryId?: string
}

/**
 * Atomic: [expense transaction] + payment ledger entry + debt balance + audit.
 * Rules reject a balance change not backed by a new payment with matching principalDelta.
 */
export async function recordDebtPayment(uid: string, debt: Debt, input: DebtPaymentInput): Promise<void> {
  const newBalance = debt.outstandingBalance - input.amount
  if (newBalance < 0) throw new Error('Amount exceeds the outstanding balance.')
  const paymentId = newId(uid, 'debtPayments')
  const batch = newBatch()

  let transactionId: string | undefined
  if (input.kind === 'payment' && input.accountId && input.categoryId) {
    transactionId = newId(uid, 'transactions')
    batch.set(
      userDoc(uid, 'transactions', transactionId),
      forCreate(uid, {
        type: 'expense',
        amount: input.amount,
        currency: 'PHP',
        accountId: input.accountId,
        categoryId: input.categoryId,
        description: `Debt payment: ${debt.name}`.slice(0, 120),
        date: input.date,
      }),
    )
  }

  batch.set(
    userDoc(uid, 'debtPayments', paymentId),
    forCreate(uid, {
      debtId: debt.id,
      kind: input.kind,
      amount: input.amount,
      principalDelta: input.amount,
      date: input.date,
      note: input.note?.trim() || undefined,
      transactionId,
    }),
  )

  const advanceSchedule = input.kind === 'payment' && debt.nextPaymentDate
  batch.update(
    userDoc(uid, 'debts', debt.id),
    forUpdate({
      outstandingBalance: newBalance,
      lastPaymentId: paymentId,
      ...(advanceSchedule ? { nextPaymentDate: nextDueDate(debt.nextPaymentDate!, debt.paymentFrequency) } : {}),
    }),
  )
  auditInBatch(batch, uid, {
    action: 'debt.payment',
    entityType: 'debt',
    entityId: debt.id,
    details: `${input.kind} ${formatMoney(input.amount)} (${debt.name})`,
  })
  await batch.commit()
}

export async function deleteDebt(uid: string, debt: Debt): Promise<void> {
  const payments = await getDocs(query(userCol(uid, 'debtPayments'), where('debtId', '==', debt.id)))
  const batch = newBatch()
  payments.docs.slice(0, 450).forEach((d) => batch.delete(d.ref))
  batch.delete(userDoc(uid, 'debts', debt.id))
  auditInBatch(batch, uid, { action: 'debt.deleted', entityType: 'debt', entityId: debt.id, details: debt.name })
  await batch.commit()
}
