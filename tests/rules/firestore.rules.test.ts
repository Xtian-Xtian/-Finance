// Firestore Security Rules tests — run with `npm run test:rules` (starts the emulator; needs Java 11+).
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore'

let env: RulesTestEnvironment

const verified = (uid: string) =>
  env.authenticatedContext(uid, { email: `${uid}@example.com`, email_verified: true }).firestore() as unknown as Firestore

const meta = (uid: string) => ({ ownerId: uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })

const account = (uid: string, extra: Record<string, unknown> = {}) => ({
  ...meta(uid),
  name: 'BPI Savings',
  type: 'bank',
  currency: 'PHP',
  openingBalance: 5_000_000,
  status: 'active',
  ...extra,
})

const expense = (uid: string, extra: Record<string, unknown> = {}) => ({
  ...meta(uid),
  type: 'expense',
  amount: 125_050,
  currency: 'PHP',
  accountId: 'acc1',
  categoryId: 'food',
  description: 'Lunch',
  date: Timestamp.fromDate(new Date()),
  ...extra,
})

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-faience-rules',
    firestore: { rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8') },
  })
})

afterAll(async () => {
  await env?.cleanup()
})

beforeEach(async () => {
  await env.clearFirestore()
  // Seed data for alice and bob with rules disabled.
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore() as unknown as Firestore
    const now = Timestamp.now()
    const seed = (uid: string) => ({ ownerId: uid, createdAt: now, updatedAt: now })
    for (const uid of ['alice', 'bob']) {
      await setDoc(doc(db, `users/${uid}`), { ...seed(uid), email: `${uid}@example.com`, displayName: uid, currency: 'PHP' })
      await setDoc(doc(db, `users/${uid}/accounts/acc1`), { ...seed(uid), name: 'Bank', type: 'bank', currency: 'PHP', openingBalance: 0, status: 'active' })
      await setDoc(doc(db, `users/${uid}/accounts/acc2`), { ...seed(uid), name: 'GCash', type: 'ewallet', currency: 'PHP', openingBalance: 0, status: 'active' })
      await setDoc(doc(db, `users/${uid}/categories/food`), { ...seed(uid), name: 'Food', type: 'expense', color: '#f59e0b' })
      await setDoc(doc(db, `users/${uid}/categories/salary`), { ...seed(uid), name: 'Salary', type: 'income', color: '#2dd4bf' })
      await setDoc(doc(db, `users/${uid}/transactions/tx1`), {
        ...seed(uid),
        type: 'expense',
        amount: 1000,
        currency: 'PHP',
        accountId: 'acc1',
        categoryId: 'food',
        description: 'Seed',
        date: now,
      })
      await setDoc(doc(db, `users/${uid}/savingsGoals/goal1`), { ...seed(uid), name: 'Emergency Fund', targetAmount: 10_000_000, currentAmount: 0 })
      await setDoc(doc(db, `users/${uid}/auditLogs/log1`), { ownerId: uid, action: 'auth.login', entityType: 'auth', createdAt: now })
    }
  })
})

describe('ownership & isolation', () => {
  it('authenticated user can access own data', async () => {
    const alice = verified('alice')
    await assertSucceeds(getDoc(doc(alice, 'users/alice')))
    await assertSucceeds(getDocs(collection(alice, 'users/alice/accounts')))
    await assertSucceeds(setDoc(doc(alice, 'users/alice/accounts/new'), account('alice')))
  })

  it("authenticated user cannot read another user's data", async () => {
    const alice = verified('alice')
    await assertFails(getDoc(doc(alice, 'users/bob')))
    await assertFails(getDoc(doc(alice, 'users/bob/accounts/acc1')))
    await assertFails(getDocs(collection(alice, 'users/bob/transactions')))
    await assertFails(getDocs(collection(alice, 'users/bob/auditLogs')))
  })

  it('unauthenticated user cannot access private financial data', async () => {
    const anon = env.unauthenticatedContext().firestore() as unknown as Firestore
    await assertFails(getDoc(doc(anon, 'users/alice')))
    await assertFails(getDocs(collection(anon, 'users/alice/transactions')))
    await assertFails(setDoc(doc(anon, 'users/alice/accounts/x'), account('alice')))
  })

  it('unverified email cannot access financial data', async () => {
    const unverified = env.authenticatedContext('alice', { email: 'alice@example.com', email_verified: false }).firestore() as unknown as Firestore
    await assertFails(getDocs(collection(unverified, 'users/alice/accounts')))
  })

  it('user cannot create data under another user', async () => {
    await assertFails(setDoc(doc(verified('alice'), 'users/bob/accounts/evil'), account('bob')))
    await assertFails(setDoc(doc(verified('alice'), 'users/bob/accounts/evil'), account('alice')))
  })

  it('user cannot change document ownership', async () => {
    await assertFails(updateDoc(doc(verified('alice'), 'users/alice/accounts/acc1'), { ownerId: 'bob', updatedAt: serverTimestamp() }))
  })

  it("user cannot modify another user's transactions", async () => {
    await assertFails(updateDoc(doc(verified('alice'), 'users/bob/transactions/tx1'), { amount: 1, updatedAt: serverTimestamp() }))
  })

  it("user cannot delete another user's accounts", async () => {
    await assertFails(deleteDoc(doc(verified('alice'), 'users/bob/accounts/acc1')))
    await assertSucceeds(deleteDoc(doc(verified('bob'), 'users/bob/accounts/acc2')))
  })

  it('arbitrary top-level collections are denied', async () => {
    await assertFails(setDoc(doc(verified('alice'), 'public/anything'), { a: 1 }))
  })
})

describe('validation', () => {
  it('accepts a valid expense', async () => {
    await assertSucceeds(setDoc(doc(verified('alice'), 'users/alice/transactions/t'), expense('alice')))
  })

  it('rejects non-integer, zero, negative and oversized amounts', async () => {
    const alice = verified('alice')
    for (const amount of [12.5, 0, -100, 1e15, '100']) {
      await assertFails(setDoc(doc(alice, 'users/alice/transactions/t'), expense('alice', { amount })))
    }
  })

  it('rejects unknown fields (mass assignment)', async () => {
    await assertFails(setDoc(doc(verified('alice'), 'users/alice/transactions/t'), expense('alice', { isAdmin: true })))
    await assertFails(setDoc(doc(verified('alice'), 'users/alice/accounts/cc'), account('alice', { type: 'credit_card', cvv: '123' })))
  })

  it('only allows the last four card digits', async () => {
    const alice = verified('alice')
    await assertSucceeds(setDoc(doc(alice, 'users/alice/accounts/cc'), account('alice', { type: 'credit_card', lastFour: '1234', openingBalance: -1000 })))
    await assertFails(setDoc(doc(alice, 'users/alice/accounts/cc2'), account('alice', { type: 'credit_card', lastFour: '4111111111111111' })))
  })

  it("rejects references to accounts/categories that aren't the user's (IDOR)", async () => {
    const alice = verified('alice')
    await assertFails(setDoc(doc(alice, 'users/alice/transactions/t'), expense('alice', { accountId: 'does-not-exist' })))
    await assertFails(setDoc(doc(alice, 'users/alice/transactions/t'), expense('alice', { categoryId: 'nope' })))
  })

  it('rejects a category of the wrong type', async () => {
    await assertFails(setDoc(doc(verified('alice'), 'users/alice/transactions/t'), expense('alice', { categoryId: 'salary' })))
  })

  it('rejects client-supplied timestamps', async () => {
    const spoofed = Timestamp.fromDate(new Date('2020-01-01'))
    await assertFails(setDoc(doc(verified('alice'), 'users/alice/transactions/t'), expense('alice', { createdAt: spoofed })))
  })

  it('transfers need two distinct owned accounts and no category', async () => {
    const alice = verified('alice')
    const transfer = { ...meta('alice'), type: 'transfer', amount: 500_000, currency: 'PHP', fromAccountId: 'acc1', toAccountId: 'acc2', description: 'Top up', date: Timestamp.now() }
    await assertSucceeds(setDoc(doc(alice, 'users/alice/transactions/tr'), transfer))
    await assertFails(setDoc(doc(alice, 'users/alice/transactions/tr2'), { ...transfer, toAccountId: 'acc1' }))
    await assertFails(setDoc(doc(alice, 'users/alice/transactions/tr3'), { ...transfer, categoryId: 'food' }))
  })

  it('rejects dates far in the future', async () => {
    const future = Timestamp.fromDate(new Date(Date.now() + 5 * 365 * 86_400_000))
    await assertFails(setDoc(doc(verified('alice'), 'users/alice/transactions/t'), expense('alice', { date: future })))
  })
})

describe('ledger integrity', () => {
  it('savings total cannot change without a matching contribution', async () => {
    await assertFails(updateDoc(doc(verified('alice'), 'users/alice/savingsGoals/goal1'), { currentAmount: 999_999, updatedAt: serverTimestamp() }))
  })

  it('savings contribution + goal total succeed atomically', async () => {
    const alice = verified('alice')
    const batch = writeBatch(alice)
    batch.set(doc(alice, 'users/alice/savingsContributions/c1'), { ...meta('alice'), goalId: 'goal1', amount: 250_000, date: Timestamp.now() })
    batch.update(doc(alice, 'users/alice/savingsGoals/goal1'), { currentAmount: 250_000, lastContributionId: 'c1', updatedAt: serverTimestamp() })
    await assertSucceeds(batch.commit())
  })

  it('goal total must equal the contribution amount', async () => {
    const alice = verified('alice')
    const batch = writeBatch(alice)
    batch.set(doc(alice, 'users/alice/savingsContributions/c1'), { ...meta('alice'), goalId: 'goal1', amount: 100, date: Timestamp.now() })
    batch.update(doc(alice, 'users/alice/savingsGoals/goal1'), { currentAmount: 1_000_000, lastContributionId: 'c1', updatedAt: serverTimestamp() })
    await assertFails(batch.commit())
  })

  it('audit logs are append-only', async () => {
    const alice = verified('alice')
    await assertSucceeds(setDoc(doc(alice, 'users/alice/auditLogs/new'), { ownerId: 'alice', action: 'transaction.created', entityType: 'transaction', createdAt: serverTimestamp() }))
    await assertFails(updateDoc(doc(alice, 'users/alice/auditLogs/log1'), { details: 'tampered' }))
    await assertFails(deleteDoc(doc(alice, 'users/alice/auditLogs/log1')))
  })

  it('profile email must match the auth token and cannot be deleted', async () => {
    const alice = verified('alice')
    await assertFails(updateDoc(doc(alice, 'users/alice'), { email: 'attacker@example.com', updatedAt: serverTimestamp() }))
    await assertFails(deleteDoc(doc(alice, 'users/alice')))
  })
})
