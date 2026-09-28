export type Period = 'daily' | 'weekly' | 'monthly' | 'yearly'

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function addDays(d: Date, days: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + days)
  return r
}

/** Add months, clamping the day (Jan 31 + 1 month => Feb 28/29). */
export function addMonths(d: Date, months: number): Date {
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1, d.getHours(), d.getMinutes())
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(d.getDate(), lastDay))
  return target
}

export function startOfWeek(d: Date): Date {
  const s = startOfDay(d)
  const day = (s.getDay() + 6) % 7 // Monday = 0
  return addDays(s, -day)
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

export function startOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 0, 1)
}

export function startOfPeriod(d: Date, period: Period): Date {
  switch (period) {
    case 'daily':
      return startOfDay(d)
    case 'weekly':
      return startOfWeek(d)
    case 'monthly':
      return startOfMonth(d)
    case 'yearly':
      return startOfYear(d)
  }
}

/** Shift a period start by n periods. */
export function shiftPeriod(d: Date, period: Period, n: number): Date {
  switch (period) {
    case 'daily':
      return addDays(d, n)
    case 'weekly':
      return addDays(d, n * 7)
    case 'monthly':
      return new Date(d.getFullYear(), d.getMonth() + n, 1)
    case 'yearly':
      return new Date(d.getFullYear() + n, 0, 1)
  }
}

export function periodLabel(d: Date, period: Period): string {
  switch (period) {
    case 'daily':
      return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
    case 'weekly':
      return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
    case 'monthly':
      return d.toLocaleDateString('en-PH', { month: 'short', year: '2-digit' })
    case 'yearly':
      return String(d.getFullYear())
  }
}

export const PERIOD_NOUN: Record<Period, string> = {
  daily: 'today',
  weekly: 'this week',
  monthly: 'this month',
  yearly: 'this year',
}

/** "YYYY-MM" month id in local time. */
export function monthId(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function monthIdToDate(id: string): Date {
  const [y, m] = id.split('-').map(Number)
  return new Date(y, m - 1, 1)
}

export function formatMonthId(id: string): string {
  return monthIdToDate(id).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })
}

export function formatDate(d: Date | null | undefined): string {
  if (!d) return '—'
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function formatDateTime(d: Date | null | undefined): string {
  if (!d) return '—'
  return d.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })
}

/** Value for <input type="date"> in local time. */
export function toDateInput(d: Date | null | undefined): string {
  if (!d) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Parse an <input type="date"> value as local noon (avoids timezone day shifts). */
export function fromDateInput(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(y, m - 1, d, 12)
  if (date.getMonth() !== m - 1) return null
  return date
}

export function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86_400_000)
}
