// Shared client-side validation helpers. These mirror firestore.rules — the rules remain
// the final security boundary; these exist for UX and application correctness.
import { MAX_CENTAVOS } from './money'

export type Errors = Record<string, string | undefined>

export function hasErrors(errors: Errors): boolean {
  return Object.values(errors).some(Boolean)
}

export function requireText(value: string, label: string, max: number): string | undefined {
  const v = value.trim()
  if (!v) return `${label} is required.`
  if (v.length > max) return `${label} must be at most ${max} characters.`
  return undefined
}

export function optionalText(value: string, label: string, max: number): string | undefined {
  if (value.trim().length > max) return `${label} must be at most ${max} characters.`
  return undefined
}

export function requirePositiveMoney(value: number | null, label = 'Amount'): string | undefined {
  if (value === null) return `${label} must be a valid amount (e.g. 1,250.50).`
  if (value <= 0) return `${label} must be greater than zero.`
  if (value > MAX_CENTAVOS) return `${label} is too large.`
  return undefined
}

export function requireMoney(value: number | null, label = 'Amount'): string | undefined {
  if (value === null) return `${label} must be a valid amount (e.g. 1,250.50).`
  if (Math.abs(value) > MAX_CENTAVOS) return `${label} is too large.`
  return undefined
}

export function requireBusinessDate(value: Date | null, label = 'Date'): string | undefined {
  if (!value) return `${label} is required.`
  const max = Date.now() + 365 * 86_400_000
  if (value.getTime() < new Date(1970, 0, 2).getTime() || value.getTime() > max) {
    return `${label} is out of range.`
  }
  return undefined
}

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

/** Password policy for sign-up / change (Firebase also enforces its own minimum). */
export function passwordProblem(password: string): string | undefined {
  if (password.length < 10) return 'Use at least 10 characters.'
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) return 'Use both upper and lower case letters.'
  if (!/\d/.test(password)) return 'Include at least one number.'
  return undefined
}
