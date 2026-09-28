import { describe, expect, it } from 'vitest'
import { buildAppsScript } from '../gmailImport/appsScript'
import type { Account } from '../accounts/types'
import { computeBalances } from '../accounts/accountCalc'
import { netWorthBreakdown } from '../networth/netWorthCalc'
import type { Transaction } from '../transactions/types'
import { buildCoachSummary } from './coachSummary'

const meta = { ownerId: 'u1', createdAt: new Date(), updatedAt: new Date() }

describe('coach summary', () => {
  const accounts: Account[] = [
    { id: 'cash', ...meta, name: 'BPI Cash', type: 'cash', currency: 'PHP', openingBalance: 3434, status: 'active' },
    { id: 'be', ...meta, name: 'Billease', type: 'credit_card', currency: 'PHP', openingBalance: 0, status: 'active', lastFour: '1385', creditLimit: 500000 },
  ]
  const transactions: Transaction[] = [
    { id: 't', ...meta, type: 'expense', amount: 19500, currency: 'PHP', accountId: 'be', categoryId: 'food', description: 'KFC GAISANO DAVAO', notes: 'secret note', date: new Date(Date.now() - 60_000) },
  ]
  const balances = computeBalances(accounts, transactions)
  const summary = buildCoachSummary({
    accounts, balances, transactions, debts: [], bills: [], savingsGoals: [], financialGoals: [],
    categories: [{ id: 'food', ...meta, name: 'Food', type: 'expense', color: '#fff' }],
    netWorth: netWorthBreakdown(accounts, balances, [], []),
  })

  it('reports balances in pesos and owed amounts on credit lines', () => {
    expect(summary.assetAccounts[0]).toMatchObject({ name: 'BPI Cash', balancePhp: 34.34 })
    expect(summary.creditLinesAndLoans[0]).toMatchObject({ name: 'Billease', owedPhp: 195, limitPhp: 5000 })
    expect(summary.spendingLast30DaysByCategory[0]).toEqual({ category: 'Food', amountPhp: 195 })
  })

  it('never includes descriptions, notes or card digits', () => {
    const json = JSON.stringify(summary)
    expect(json).not.toContain('KFC')
    expect(json).not.toContain('secret note')
    expect(json).not.toContain('1385')
  })
})

/** Runs the generated Apps Script doPost against stubbed Google services. */
function runCoach(opts: { lookupUser?: object; claude: { code: number; body: object }; key?: string | null; used?: number }) {
  const script = buildAppsScript({
    apiKey: 'FIREBASE_KEY', projectId: 'p', uid: 'u1', refreshToken: 't', defaultAccountId: 'a',
    accountsByLastFour: {}, incomeCategoryId: 'i', expenseCategoryId: 'e', categoryRules: [], transferRules: [], billeaseAccountId: null,
  })
  const calls: Array<{ url: string; params: { headers?: Record<string, string>; payload: string } }> = []
  const props: Record<string, string> = {}
  if (opts.key !== null) props.ANTHROPIC_API_KEY = opts.key ?? 'sk-ant-test'
  if (opts.used) props['COACH_2026-09-28'] = String(opts.used)
  const stubs = {
    UrlFetchApp: {
      fetch(url: string, params: { headers?: Record<string, string>; payload: string }) {
        calls.push({ url, params })
        const isLookup = url.includes('accounts:lookup')
        const code = isLookup ? 200 : opts.claude.code
        const body = isLookup ? { users: [opts.lookupUser ?? { localId: 'u1', emailVerified: true }] } : opts.claude.body
        return { getResponseCode: () => code, getContentText: () => JSON.stringify(body) }
      },
    },
    PropertiesService: {
      getScriptProperties: () => ({ getProperty: (k: string) => props[k] ?? null, setProperty: (k: string, v: string) => void (props[k] = v) }),
      getUserProperties: () => ({ getProperty: () => null, setProperty() {} }),
    },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: { formatDate: () => '2026-09-28', getUuid: () => 'uuid' },
    ContentService: { createTextOutput: (s: string) => ({ setMimeType: () => s }), MimeType: { JSON: 'json' } },
    Logger: { log() {} },
  }
  const doPost = new Function(...Object.keys(stubs), `${script}; return doPost;`)(...Object.values(stubs))
  const out = JSON.parse(doPost({ postData: { contents: JSON.stringify({ idToken: 'tok', summary: { a: 1 }, question: 'When?' }) } }))
  return { out, calls, props }
}

const ADVICE = { summary: 's', debtFreeEstimate: { months: 6, targetMonth: 'March 2027', basis: 'b' }, payoffOrder: [], actions: [], warnings: [] }

describe('coach Apps Script (doPost)', () => {
  it('verifies the user, calls Claude correctly and returns parsed advice', () => {
    const { out, calls, props } = runCoach({
      claude: { code: 200, body: { stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: JSON.stringify(ADVICE) }] } },
    })
    expect(out).toEqual({ ok: true, advice: ADVICE })
    expect(calls[0].url).toContain('accounts:lookup?key=FIREBASE_KEY')
    const claude = calls[1]
    expect(claude.url).toBe('https://api.anthropic.com/v1/messages')
    expect(claude.params.headers).toMatchObject({ 'x-api-key': 'sk-ant-test', 'anthropic-version': '2023-06-01', 'anthropic-beta': 'server-side-fallback-2026-07-01' })
    const body = JSON.parse(claude.params.payload)
    expect(body).toMatchObject({ model: 'claude-opus-5', fallbacks: 'default', thinking: { type: 'adaptive' } })
    expect(body.output_config.format.type).toBe('json_schema')
    expect(body.messages[0].content).toContain('When?')
    expect(props['COACH_2026-09-28']).toBe('1')
  })

  it('rejects a different Firebase user without calling Claude', () => {
    const { out, calls } = runCoach({ lookupUser: { localId: 'attacker', emailVerified: true }, claude: { code: 200, body: {} } })
    expect(out).toEqual({ error: 'unauthorized' })
    expect(calls).toHaveLength(1)
  })

  it('enforces the daily limit and a missing key', () => {
    expect(runCoach({ used: 15, claude: { code: 200, body: {} } }).out).toEqual({ error: 'limit' })
    expect(runCoach({ key: null, claude: { code: 200, body: {} } }).out).toEqual({ error: 'no_key' })
  })

  it('surfaces refusals and API errors', () => {
    expect(runCoach({ claude: { code: 200, body: { stop_reason: 'refusal', content: [] } } }).out).toEqual({ error: 'refusal' })
    expect(runCoach({ claude: { code: 529, body: { type: 'error' } } }).out).toEqual({ error: 'api' })
  })
})
