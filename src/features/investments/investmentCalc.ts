import type { Investment, InvestmentTransaction } from './types'

export interface InvestmentPerformance {
  contributions: number
  withdrawals: number
  netInvested: number
  currentValue: number
  /** Unrealised gain/loss on user-provided values. Past values do not guarantee future returns. */
  gain: number
  gainPercent: number | null
}

export function investmentPerformance(
  investment: Investment,
  transactions: InvestmentTransaction[],
): InvestmentPerformance {
  let contributions = 0
  let withdrawals = 0
  for (const t of transactions) {
    if (t.investmentId !== investment.id) continue
    if (t.kind === 'contribution') contributions += t.amount
    else withdrawals += t.amount
  }
  const netInvested = contributions - withdrawals
  const gain = investment.currentValue - netInvested
  return {
    contributions,
    withdrawals,
    netInvested,
    currentValue: investment.currentValue,
    gain,
    gainPercent: netInvested > 0 ? Math.round((gain / netInvested) * 1000) / 10 : null,
  }
}

/** Cost basis = quantity × average price, rounded to centavos. */
export function costBasis(quantity: number, purchasePrice: number): number {
  return Math.round(quantity * purchasePrice)
}
