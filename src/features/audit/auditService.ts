import { addDoc, doc, serverTimestamp, type WriteBatch } from 'firebase/firestore'
import { userCol } from '../../lib/firestore'
import type { AuditEntry } from './types'

function payload(uid: string, entry: AuditEntry) {
  const data: Record<string, unknown> = {
    ownerId: uid,
    action: entry.action,
    entityType: entry.entityType,
    createdAt: serverTimestamp(),
  }
  if (entry.entityId) data.entityId = entry.entityId
  if (entry.details) data.details = entry.details.slice(0, 300)
  return data
}

/** Add an audit entry to an existing batch so it commits atomically with the change. */
export function auditInBatch(batch: WriteBatch, uid: string, entry: AuditEntry): void {
  batch.set(doc(userCol(uid, 'auditLogs')), payload(uid, entry))
}

/** Standalone audit write (auth events). Failures are swallowed so they never block the user. */
export async function logAudit(uid: string, entry: AuditEntry): Promise<void> {
  try {
    await addDoc(userCol(uid, 'auditLogs'), payload(uid, entry))
  } catch (err) {
    if (import.meta.env.DEV) console.warn('Audit log write failed', err)
  }
}
