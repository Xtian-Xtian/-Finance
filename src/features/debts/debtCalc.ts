import type { Debt, PaymentFrequency } from './types'

const PERIODS_PER_YEAR: Record<PaymentFrequency, number> = { weekly: 52, monthly: 12, quarterly: 4, yearly: 1 }

export interface PayoffEstimate {
  /** Number of scheduled payments needed, or null if the payment never covers interest. */
  payments: number | null
  totalInterest: number | null
}

/**
 * ESTIMATE ONLY: amortised payoff assuming a fixed rate and the scheduled payment
 * amount. Real lenders may compute interest differently. This is not financial advice.
 */
export function estimatePayoff(debt: Pick<Debt, 'outstandingBalance' | 'interestRate' | 'paymentAmount' | 'paymentFrequency'>): PayoffEstimate {
  let balance = debt.outstandingBalance
  if (balance <= 0) return { payments: 0, totalInterest: 0 }
  if (debt.paymentAmount <= 0) return { payments: null, totalInterest: null }
  const rate = debt.interestRate / 10000 / PERIODS_PER_YEAR[debt.paymentFrequency]
  let payments = 0
  let totalInterest = 0
  while (balance > 0) {
    const interest = Math.round(balance * rate)
    if (debt.paymentAmount <= interest) return { payments: null, totalInterest: null }
    totalInterest += interest
    balance = balance + interest - debt.paymentAmount
    payments++
    if (payments > 1200) return { payments: null, totalInterest: null }
  }
  return { payments, totalInterest }
}

export function paidOffPercent(debt: Pick<Debt, 'principal' | 'outstandingBalance'>): number {
  if (debt.principal <= 0) return 0
  return Math.max(0, Math.min(100, Math.round(((debt.principal - debt.outstandingBalance) / debt.principal) * 100)))
}
