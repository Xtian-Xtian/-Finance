import { auth } from '../../lib/firebase'
import { logAudit } from '../audit/auditService'
import type { CoachSummary } from './coachSummary'

/** Only Google Apps Script web-app URLs are accepted (the ID token is never sent anywhere else). */
export const COACH_URL_PATTERN = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]{20,}\/exec$/

export interface CoachAdvice {
  summary: string
  debtFreeEstimate: { months: number; targetMonth: string; basis: string }
  payoffOrder: Array<{ name: string; reason: string }>
  actions: Array<{ title: string; detail: string; monthlyImpactPhp: number }>
  warnings: string[]
}

export class CoachError extends Error {}

const MESSAGES: Record<string, string> = {
  unauthorized: 'The coach could not verify your login. Sign out and in again, then retry.',
  no_key: 'The Anthropic API key is not set in your Apps Script (Project Settings → Script properties).',
  limit: 'Daily AI coach limit reached (15 requests). Try again tomorrow.',
  refusal: 'The AI declined this request. Try rephrasing your question.',
  bad_request: 'The request was too large or invalid.',
  api: 'The AI service returned an error. Please try again in a moment.',
}

export async function askCoach(coachUrl: string, summary: CoachSummary, question: string, extraMonthlyPhp: number | null): Promise<CoachAdvice> {
  if (!COACH_URL_PATTERN.test(coachUrl)) throw new CoachError('The coach URL in Settings is not a valid Apps Script web-app URL.')
  const user = auth.currentUser
  if (!user) throw new CoachError('Not signed in.')
  const idToken = await user.getIdToken()

  let res: Response
  try {
    // text/plain avoids a CORS preflight, which Apps Script web apps cannot answer.
    res = await fetch(coachUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ idToken, summary, question: question.trim().slice(0, 500), extraMonthlyPhp }),
    })
  } catch {
    throw new CoachError('Could not reach your Apps Script. Check the coach URL and that the web app is deployed with access "Anyone".')
  }
  let data: { ok?: boolean; advice?: CoachAdvice; error?: string }
  try {
    data = await res.json()
  } catch {
    throw new CoachError('Unexpected response from Apps Script. Redeploy the web app (Deploy → Manage deployments → new version).')
  }
  if (!data.ok || !data.advice) throw new CoachError(MESSAGES[data.error ?? ''] ?? 'The AI coach failed. Please try again.')
  await logAudit(user.uid, { action: 'coach.requested', entityType: 'coach', details: 'Debt-free AI suggestion generated' })
  return data.advice
}
