// Firestore helpers shared by every feature service.
// All paths are rooted at users/{uid}, so every query's result set satisfies the ownership rules.
import {
  collection,
  deleteField,
  doc,
  serverTimestamp,
  Timestamp,
  writeBatch,
  type DocumentData,
  type WriteBatch,
} from 'firebase/firestore'
import { db } from './firebase'

export type UserCollection =
  | 'accounts'
  | 'transactions'
  | 'categories'
  | 'budgets'
  | 'savingsGoals'
  | 'savingsContributions'
  | 'bills'
  | 'debts'
  | 'debtPayments'
  | 'investments'
  | 'investmentTransactions'
  | 'financialGoals'
  | 'netWorthSnapshots'
  | 'auditLogs'

/** Common fields present on every stored entity after reading. */
export interface Entity {
  id: string
  ownerId: string
  createdAt: Date
  updatedAt: Date
}

/** Shape of the editable part of an entity. */
export type Input<T extends Entity> = Omit<T, keyof Entity>

export function userCol(uid: string, name: UserCollection) {
  return collection(db, 'users', uid, name)
}

export function userDoc(uid: string, name: UserCollection, id: string) {
  return doc(db, 'users', uid, name, id)
}

export function newId(uid: string, name: UserCollection): string {
  return doc(userCol(uid, name)).id
}

type Plain = Record<string, unknown>

function toFirestoreValue(value: unknown): unknown {
  if (value instanceof Date) return Timestamp.fromDate(value)
  // -0 (e.g. negating a zero liability) is serialised as a double, which the rules
  // reject as non-integer money. Normalise it to 0.
  if (typeof value === 'number' && Object.is(value, -0)) return 0
  return value
}

/** Payload for a create: strips undefined, adds ownerId + server timestamps. */
export function forCreate(uid: string, data: object): DocumentData {
  const out: DocumentData = {}
  for (const [k, v] of Object.entries(data as Plain)) {
    if (k === 'id' || v === undefined) continue
    out[k] = toFirestoreValue(v)
  }
  return { ...out, ownerId: uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }
}

/** Payload for an update: undefined removes optional fields; ownerId/createdAt are never sent. */
export function forUpdate(data: object): DocumentData {
  const out: DocumentData = {}
  for (const [k, v] of Object.entries(data as Plain)) {
    if (k === 'id' || k === 'ownerId' || k === 'createdAt' || k === 'updatedAt') continue
    out[k] = v === undefined ? deleteField() : toFirestoreValue(v)
  }
  return { ...out, updatedAt: serverTimestamp() }
}

export function newBatch(): WriteBatch {
  return writeBatch(db)
}

/** Convert Firestore Timestamps in a document to JS Dates (shallow). */
export function fromFirestore<T>(id: string, data: DocumentData): T {
  const out: Plain = { id }
  for (const [k, v] of Object.entries(data)) out[k] = v instanceof Timestamp ? v.toDate() : v
  return out as T
}

/** Map low-level Firestore errors to safe, user-facing messages (no internals leaked). */
export function friendlyError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? ''
  if (code === 'permission-denied') {
    return 'This change was rejected by the security rules. Check your input and try again.'
  }
  if (code === 'unavailable') return 'You appear to be offline. Please try again.'
  if (code === 'not-found') return 'That item no longer exists.'
  if (import.meta.env.DEV) console.error(err)
  return 'Something went wrong. Please try again.'
}
