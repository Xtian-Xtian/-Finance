// All money is stored as integer centavos (₱1,250.50 => 125050) to avoid floating-point drift.

export const CURRENCY = 'PHP' as const
export const MAX_CENTAVOS = 99_999_999_999_999 // ₱999,999,999,999.99 — mirrors firestore.rules

const formatter = new Intl.NumberFormat('en-PH', { style: 'currency', currency: CURRENCY })
const compactFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: CURRENCY,
  notation: 'compact',
  maximumFractionDigits: 1,
})

export function formatMoney(centavos: number): string {
  // `|| 0` turns -0 (e.g. negating a zero liability) into 0 so it never shows as "-₱0.00".
  return formatter.format((centavos || 0) / 100)
}

export function formatMoneyCompact(centavos: number): string {
  return compactFormatter.format((centavos || 0) / 100)
}

/**
 * Parse user input like "1,250.50" or "-300" into integer centavos using string
 * arithmetic only (no float multiplication). Returns null when invalid.
 */
export function parseMoney(input: string, { allowNegative = false } = {}): number | null {
  const cleaned = input.replace(/[₱,\s]/g, '')
  const match = /^(-)?(\d{1,12})(?:\.(\d{1,2}))?$/.exec(cleaned)
  if (!match) return null
  const [, sign, whole, fraction = ''] = match
  if (sign && !allowNegative) return null
  const centavos = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  if (centavos > MAX_CENTAVOS) return null
  return sign && centavos !== 0 ? -centavos : centavos
}

/** Convert centavos back to an editable string ("1250.50"). */
export function toMoneyInput(centavos: number): string {
  const sign = centavos < 0 ? '-' : ''
  const abs = Math.abs(centavos)
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`
}

export function sum(values: number[]): number {
  return values.reduce((total, v) => total + v, 0)
}

/** Integer percentage of part/whole, safe for whole = 0. */
export function percent(part: number, whole: number): number {
  if (whole <= 0) return 0
  return Math.round((part / whole) * 100)
}

/** Percentage change between two periods (1 decimal), or null when there is no baseline. */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10
}
