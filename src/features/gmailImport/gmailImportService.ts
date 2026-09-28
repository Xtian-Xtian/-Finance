import { newBatch, userDoc } from '../../lib/firestore'
import { auditInBatch } from '../audit/auditService'
import type { Transaction } from '../transactions/types'

/** Deletes all Gmail-imported transactions (so the script's `reimport` can recreate them). */
export async function deleteImportedTransactions(uid: string, transactions: Transaction[]): Promise<number> {
  const imported = transactions.filter((t) => t.source === 'gmail')
  for (let i = 0; i < imported.length; i += 400) {
    const chunk = imported.slice(i, i + 400)
    const batch = newBatch()
    chunk.forEach((t) => batch.delete(userDoc(uid, 'transactions', t.id)))
    auditInBatch(batch, uid, { action: 'transaction.deleted', entityType: 'transaction', details: `Removed ${chunk.length} Gmail-imported transactions` })
    await batch.commit()
  }
  return imported.length
}
