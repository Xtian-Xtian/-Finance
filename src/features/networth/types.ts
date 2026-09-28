import type { Entity } from '../../lib/firestore'

/** Monthly snapshot (doc id = "YYYY-MM") so history includes investments and debts. */
export interface NetWorthSnapshot extends Entity {
  month: string
  assets: number
  liabilities: number
  netWorth: number
}

export interface NetWorthBreakdown {
  cash: number
  bank: number
  ewallet: number
  investmentAccounts: number
  investmentHoldings: number
  creditCards: number
  loans: number
  debts: number
  assets: number
  liabilities: number
  netWorth: number
}
