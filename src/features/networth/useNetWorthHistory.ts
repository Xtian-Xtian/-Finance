import { useEffect, useMemo } from 'react'
import { useFinance } from '../../data/FinanceDataProvider'
import { monthId } from '../../lib/dates'
import { netWorthHistory } from './netWorthCalc'
import { saveMonthlySnapshot } from './netWorthService'

/** Net worth history + keeps the current month's snapshot up to date (debounced). */
export function useNetWorthHistory(months = 12) {
  const { uid, accounts, transactions, snapshots, netWorth } = useFinance()
  const month = monthId(new Date())
  const existing = snapshots.find((s) => s.month === month)

  useEffect(() => {
    if (!uid || (!accounts.length && netWorth.assets === 0 && netWorth.liabilities === 0)) return
    const timer = setTimeout(() => {
      saveMonthlySnapshot(uid, month, netWorth, existing).catch((err) => {
        if (import.meta.env.DEV) console.warn('Snapshot failed', err)
      })
    }, 1500)
    return () => clearTimeout(timer)
  }, [uid, month, netWorth, existing, accounts.length])

  return useMemo(
    () => netWorthHistory(accounts, transactions, snapshots, netWorth, months),
    [accounts, transactions, snapshots, netWorth, months],
  )
}
