import { describe, expect, it } from 'vitest'
import { formatMoney, MAX_CENTAVOS, parseMoney, percentChange, toMoneyInput } from './money'
import { toCsv } from './csv'

describe('parseMoney', () => {
  it('parses pesos into integer centavos without float error', () => {
    expect(parseMoney('1,250.50')).toBe(125050)
    expect(parseMoney('0.1')).toBe(10)
    expect(parseMoney('0.29')).toBe(29) // 0.29 * 100 = 28.999999999999996 with floats
    expect(parseMoney('₱ 50,000')).toBe(5000000)
  })

  it('rejects invalid input', () => {
    for (const bad of ['', 'abc', '1.234', '1e5', '--1', '1.2.3', '.5']) expect(parseMoney(bad)).toBeNull()
  })

  it('handles negatives only when allowed', () => {
    expect(parseMoney('-300')).toBeNull()
    expect(parseMoney('-300', { allowNegative: true })).toBe(-30000)
  })

  it('enforces the maximum', () => {
    expect(parseMoney('999999999999.99')).toBe(MAX_CENTAVOS)
    expect(parseMoney('9999999999999')).toBeNull()
  })

  it('round-trips through toMoneyInput', () => {
    for (const c of [0, 5, 125050, -30000, 99]) expect(parseMoney(toMoneyInput(c), { allowNegative: true })).toBe(c)
  })
})

describe('formatMoney', () => {
  it('never shows negative zero', () => {
    expect(formatMoney(-0)).toBe(formatMoney(0))
    expect(formatMoney(-0)).not.toContain('-')
  })
})

describe('percentChange', () => {
  it('returns null without a baseline', () => expect(percentChange(100, 0)).toBeNull())
  it('computes one-decimal change', () => expect(percentChange(115, 100)).toBe(15))
})

describe('toCsv', () => {
  it('neutralises spreadsheet formula injection', () => {
    expect(toCsv([['=HYPERLINK("x")', '+1', '@cmd', 'safe']])).toBe(`"'=HYPERLINK(""x"")",'+1,'@cmd,safe`)
  })
  it('does not alter negative numbers passed as numbers', () => {
    expect(toCsv([[-5]])).toBe('-5')
  })
})
