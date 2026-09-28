import { setDoc, updateDoc } from 'firebase/firestore'
import { forCreate, forUpdate, userDoc } from '../../lib/firestore'
import type { NetWorthBreakdown, NetWorthSnapshot } from './types'

/** Records this month's net worth so future history includes investments and debts. */
export async function saveMonthlySnapshot(
  uid: string,
  month: string,
  breakdown: NetWorthBreakdown,
  existing: NetWorthSnapshot | undefined,
): Promise<void> {
  const values = { month, assets: breakdown.assets, liabilities: breakdown.liabilities, netWorth: breakdown.netWorth }
  if (
    existing &&
    existing.assets === values.assets &&
    existing.liabilities === values.liabilities
  ) {
    return
  }
  const ref = userDoc(uid, 'netWorthSnapshots', month)
  if (existing) await updateDoc(ref, forUpdate(values))
  else await setDoc(ref, forCreate(uid, values))
}
