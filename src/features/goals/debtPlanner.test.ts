import { describe, expect, it } from 'vitest'
import { buildSuggestions, defaultBudget, defaultMinimum, simulatePayoff, type PlanDebt } from './debtPlanner'

const card: PlanDebt = { id: 'card', name: 'BPI Card', balance: 1_000_000, apr: 36, minPayment: 50_000 } // ₱10,000 @ 3%/mo
const loan: PlanDebt = { id: 'loan', name: 'BillEase Loan', balance: 490_000, apr: 24, minPayment: 50_000 } // ₱4,900 @ 2%/mo

describe('simulatePayoff', () => {
  it('pays a zero-interest debt in exact months', () => {
    const r = simulatePayoff([{ id: 'a', name: 'A', balance: 1_200_000, apr: 0, minPayment: 100_000 }], 100_000, 'avalanche')
    expect(r).toMatchObject({ feasible: true, months: 12, totalInterest: 0, totalPaid: 1_200_000 })
    expect(r.timeline).toHaveLength(13)
  })

  it('accrues monthly interest', () => {
    const r = simulatePayoff([{ id: 'a', name: 'A', balance: 100_000, apr: 12, minPayment: 200_000 }], 200_000, 'avalanche')
    expect(r.months).toBe(1)
    expect(r.totalInterest).toBe(1_000) // 1% of ₱1,000
  })

  it('avalanche targets highest interest, snowball the smallest balance', () => {
    expect(simulatePayoff([card, loan], 300_000, 'snowball').order[0].id).toBe('loan')
    const av = simulatePayoff([card, loan], 300_000, 'avalanche')
    const sn = simulatePayoff([card, loan], 300_000, 'snowball')
    expect(av.totalInterest).toBeLessThanOrEqual(sn.totalInterest)
  })

  it('flags a budget below the minimums and payments that never cover interest', () => {
    expect(simulatePayoff([card, loan], 60_000, 'avalanche')).toMatchObject({ feasible: false, problem: 'budget_below_minimums' })
    expect(simulatePayoff([{ id: 'x', name: 'X', balance: 10_000_000, apr: 60, minPayment: 10_000 }], 10_000, 'avalanche').problem).toBe('never_pays_off')
  })
})

describe('defaults', () => {
  it('uses 3% or ₱500 for cards, never more than owed', () => {
    expect(defaultMinimum('credit_card', 1_000_000)).toBe(50_000)
    expect(defaultMinimum('credit_card', 5_000_000)).toBe(150_000)
    expect(defaultMinimum('credit_card', 19_500)).toBe(19_500)
  })
  it('budget is the average surplus but at least the minimums', () => {
    expect(defaultBudget([card, loan], 2_000_000, 1_500_000)).toBe(500_000)
    expect(defaultBudget([card, loan], 1_000_000, 1_500_000)).toBe(100_000)
  })
})

describe('buildSuggestions', () => {
  const ctx = {
    debts: [card, loan], monthlyBudget: 150_000, strategy: 'avalanche' as const,
    avgIncome: 2_000_000, avgExpenses: 1_800_000, liquid: 3_434,
    topSpending: [{ name: 'Food', amount: 500_000 }, { name: 'Subscriptions', amount: 130_000 }],
    overdueBills: [{ name: 'Meralco', amount: 250_000 }],
    creditLines: [{ name: 'Billease', owed: 400_000, limit: 500_000 }],
  }
  const s = buildSuggestions(ctx)
  it('recommends a target debt and concrete savings', () => {
    expect(s[0]).toMatchObject({ kind: 'plan', title: 'Put every extra peso on BPI Card' })
    expect(s.some((x) => x.kind === 'save' && x.title.includes('Food') && (x.monthsSooner ?? 0) >= 1)).toBe(true)
    expect(s.some((x) => x.kind === 'boost')).toBe(true)
  })
  it('warns about overdue bills, high utilisation and no buffer', () => {
    const titles = s.filter((x) => x.kind === 'warning').map((x) => x.title)
    expect(titles).toContain('Meralco is overdue')
    expect(titles).toContain('Billease is 80% used')
    expect(titles).toContain('Build a small emergency buffer')
  })
})
