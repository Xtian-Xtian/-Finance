import { monthId } from '../../lib/dates'
import { computeBalances } from '../accounts/accountCalc'
import type { Account } from '../accounts/types'
import type { Debt } from '../debts/types'
import type { Investment } from '../investments/types'
import type { Transaction } from '../transactions/types'
import type { NetWorthBreakdown, NetWorthSnapshot } from './types'

/**
 * Net worth = assets − liabilities.
 * Assets: cash, bank, e-wallet, investment account cash, investment holdings (user-valued).
 * Liabilities: amounts owed on credit cards and loan accounts, plus outstanding debts.
 * A positive balance on a liability account (overpayment) counts as an asset.
 */
export function netWorthBreakdown(
  accounts: Account[],
  balances: Map<string, number>,
  investments: Investment[],
  debts: Debt[],
): NetWorthBreakdown {
  const b: NetWorthBreakdown = {
    cash: 0,
    bank: 0,
    ewallet: 0,
    investmentAccounts: 0,
    investmentHoldings: 0,
    creditCards: 0,
    loans: 0,
    debts: 0,
    assets: 0,
    liabilities: 0,
    netWorth: 0,
  }
  let liabilityOverpayments = 0
  for (const a of accounts) {
    const bal = balances.get(a.id) ?? a.openingBalance
    switch (a.type) {
      case 'cash':
        b.cash += bal
        break
      case 'bank':
        b.bank += bal
        break
      case 'ewallet':
        b.ewallet += bal
        break
      case 'investment':
        b.investmentAccounts += bal
        break
      case 'credit_card':
        if (bal < 0) b.creditCards += -bal
        else liabilityOverpayments += bal
        break
      case 'loan':
        if (bal < 0) b.loans += -bal
        else liabilityOverpayments += bal
        break
    }
  }
  for (const i of investments) b.investmentHoldings += i.currentValue
  for (const d of debts) b.debts += d.outstandingBalance

  b.assets = b.cash + b.bank + b.ewallet + b.investmentAccounts + b.investmentHoldings + liabilityOverpayments
  b.liabilities = b.creditCards + b.loans + b.debts
  b.netWorth = b.assets - b.liabilities
  return b
}

/** Total liquid balance (cash + bank + e-wallet). */
export function liquidBalance(b: NetWorthBreakdown): number {
  return b.cash + b.bank + b.ewallet
}

export interface NetWorthPoint {
  month: string
  label: string
  netWorth: number
  assets: number
  liabilities: number
  /** 'snapshot' = recorded value incl. investments/debts; 'estimate' = derived from accounts only. */
  source: 'snapshot' | 'estimate' | 'current'
}

/**
 * Last `months` months of net worth. Uses stored monthly snapshots where available;
 * otherwise estimates from account balances at month end (accounts only).
 */
export function netWorthHistory(
  accounts: Account[],
  transactions: Transaction[],
  snapshots: NetWorthSnapshot[],
  current: NetWorthBreakdown,
  months = 12,
  now = new Date(),
): NetWorthPoint[] {
  const snapByMonth = new Map(snapshots.map((s) => [s.month, s]))
  const points: NetWorthPoint[] = []
  for (let i = months - 1; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const id = monthId(start)
    const label = start.toLocaleDateString('en-PH', { month: 'short', year: '2-digit' })
    if (i === 0) {
      points.push({ month: id, label, netWorth: current.netWorth, assets: current.assets, liabilities: current.liabilities, source: 'current' })
      continue
    }
    const snap = snapByMonth.get(id)
    if (snap) {
      points.push({ month: id, label, netWorth: snap.netWorth, assets: snap.assets, liabilities: snap.liabilities, source: 'snapshot' })
      continue
    }
    const monthEnd = new Date(start.getFullYear(), start.getMonth() + 1, 1, 0, 0, 0, -1)
    const balances = computeBalances(accounts, transactions, monthEnd)
    const est = netWorthBreakdown(accounts, balances, [], [])
    points.push({ month: id, label, netWorth: est.netWorth, assets: est.assets, liabilities: est.liabilities, source: 'estimate' })
  }
  return points
}
