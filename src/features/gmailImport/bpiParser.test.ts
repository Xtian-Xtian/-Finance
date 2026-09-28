import { describe, expect, it } from 'vitest'
import { compileBpiParser } from './bpiParser'

const parse = compileBpiParser()

describe('BPI email parser', () => {
  it('ignores non-transaction notifications from the inbox', () => {
    const notices = [
      ['Your card in GitHub Inc is ready for use again', 'Your BPI Debit Mastercard ending in 0308 has been successfully relinked'],
      ['Your card in GitHub Inc has been disabled', 'Your BPI Debit Mastercard ending in 0308 has been temporarily disabled'],
      ['Debit Card Temporary Block Confirmation', 'Number 1790408151463 BPI DEBIT MASTERCARD 536347XXXXXX0308'],
      ['Debit Card Unblock Confirmation', 'Number 1790407863803 BPI DEBIT MASTERCARD 536347XXXXXX0308'],
      ['Debit Card Deactivate E-Commerce Access Confirmation', 'Number 1790235261099'],
    ]
    for (const [s, b] of notices) expect(parse(s, b)).toBeNull()
  })

  it('reads an incoming InstaPay transfer as income', () => {
    const r = parse(
      'Incoming Interbank Funds Transfer Confirmation',
      'You have received PHP 12,500.00 from JUAN DELA CRUZ on Sep 27, 2026 to your account ending in 0308. Reference No. 1234567890.',
    )
    expect(r).toMatchObject({ type: 'income', amount: 1_250_000, lastFour: '0308', description: 'JUAN DELA CRUZ', counterparty: 'JUAN DELA CRUZ' })
    expect(r?.snippet).not.toContain('1234567890')
  })

  it('falls back to the subject when the counterparty looks like boilerplate', () => {
    const r = parse('Incoming Funds Transfer', 'Please do not reply to this email.*** You received PHP 545.00 from THIS EMAIL.* ***')
    expect(r?.description).toBe('Incoming Funds Transfer')
  })

  it('reads a card purchase as an expense', () => {
    const r = parse('Card Purchase Notification', 'Your BPI Debit Mastercard 536347XXXXXX0308 was used for a purchase of PHP 1,299.50 at NETFLIX.COM on 09/27/2026.')
    expect(r?.type).toBe('expense')
    expect(r?.amount).toBe(129_950)
    expect(r?.lastFour).toBe('0308')
    expect(r?.description).toBe('NETFLIX.COM')
  })

  it('handles amounts without decimals and the ₱ sign', () => {
    expect(parse('Bills Payment Confirmation', 'You paid ₱2500 to MERALCO.')?.amount).toBe(250_000)
  })

  it('does not treat phone or reference numbers as amounts', () => {
    expect(parse('Funds Transfer Confirmation', 'Call (+632) 8891-0000. Reference 1790408151463.')).toBeNull()
  })
})

describe('generated Apps Script', () => {
  it('is valid JavaScript', async () => {
    const { buildAppsScript } = await import('./appsScript')
    const script = buildAppsScript({
      apiKey: 'k', projectId: 'p', uid: 'u', refreshToken: 't', defaultAccountId: 'a',
      accountsByLastFour: { '0308': 'a' }, incomeCategoryId: 'i', expenseCategoryId: 'e', categoryRules: [['netflix', 'e']],
      transferRules: [['\\bcc\\b|g-?xchange', 'card']],
      billeaseAccountId: 'be',
    })
    expect(() => new Function(script)).not.toThrow()
  })
})

describe('transfer detection rules', () => {
  it('maps credit-card payments and e-wallet transfers to own accounts', async () => {
    const { buildTransferRules } = await import('./appsScript')
    const rules = buildTransferRules(
      [
        { id: 'bank', name: 'BPI', type: 'bank', institution: 'BPI' },
        { id: 'card', name: 'BPI', type: 'credit_card', lastFour: '3751' },
        { id: 'gcash', name: 'GCash', type: 'ewallet' },
      ],
      'bank',
    )
    const pick = (text: string) => rules.find(([re]) => new RegExp(re, 'i').test(text))?.[1] ?? null
    expect(pick('Bills Payment Confirmation to BPI CC')).toBe('card')
    expect(pick('XXXXXXXXXX2335 Bank Name G-XCHANGE INC')).toBe('gcash')
    expect(pick('Interbank Funds Transfer Confirmation JUAN DELA CRUZ')).toBeNull()
    expect(rules.some(([, id]) => id === 'bank')).toBe(false)
  })
})
