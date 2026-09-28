import type { Transaction } from '../transactions/types'
import type { Account } from './types'

/**
 * Effect of one transaction on each account it touches (signed centavos).
 * Transfers move money between accounts and never count as income or expense.
 */
export function balanceEffects(t: Transaction): Array<[accountId: string, delta: number]> {
  switch (t.type) {
    case 'income':
      return [[t.accountId, t.amount]]
    case 'expense':
      return [[t.accountId, -t.amount]]
    case 'adjustment':
      return [[t.accountId, t.amount]]
    case 'transfer':
      return [
        [t.fromAccountId, -t.amount],
        [t.toAccountId, t.amount],
      ]
  }
}

/**
 * Derived account balances = opening balance + effect of every transaction (optionally up to
 * `asOf`). Balances are derived rather than stored, so they can never drift out of sync.
 */
export function computeBalances(
  accounts: Account[],
  transactions: Transaction[],
  asOf?: Date,
): Map<string, number> {
  const balances = new Map<string, number>()
  for (const a of accounts) balances.set(a.id, a.openingBalance)
  for (const t of transactions) {
    if (asOf && t.date > asOf) continue
    for (const [accountId, delta] of balanceEffects(t)) {
      if (balances.has(accountId)) balances.set(accountId, balances.get(accountId)! + delta)
    }
  }
  return balances
}

/** Mask sensitive identifiers: "•••• 1234". */
export function maskLastFour(lastFour?: string): string {
  return lastFour ? `•••• ${lastFour}` : ''
}

/** Credit card: amount owed and available credit, from a (usually negative) balance. */
export function creditCardUsage(account: Account, balance: number) {
  const owed = Math.max(0, -balance)
  const limit = account.creditLimit ?? 0
  return { owed, limit, available: Math.max(0, limit - owed), utilisation: limit ? Math.round((owed / limit) * 100) : 0 }
}

/**
 * Target balance from what the user's bank/lender app shows today.
 * Assets: the balance itself. Liabilities: -(amount owed), where owed can also be derived
 * from the limit minus available credit.
 */
export function targetBalance(
  account: Pick<Account, 'type' | 'creditLimit'>,
  input: { mode: 'balance' | 'owed' | 'available'; amount: number },
): number {
  if (input.mode === 'balance') return input.amount
  const owed = input.mode === 'owed' ? input.amount : (account.creditLimit ?? 0) - input.amount
  return -owed
}
