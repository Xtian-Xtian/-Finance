// Thin wrapper over Firebase Authentication — the only source of truth for identity.
// We never implement our own password handling and never store passwords anywhere.
import {
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  updateProfile,
} from 'firebase/auth'
import { auth } from '../../lib/firebase'
import { logAudit } from '../audit/auditService'

// ---- Client-side brute-force throttle (Firebase Auth also rate-limits server-side) ----
const THROTTLE_KEY = 'pf.loginThrottle'
const MAX_ATTEMPTS = 5
const LOCK_MS = 60_000

interface Throttle {
  failures: number
  lockedUntil: number
  /** Failures since the last successful sign-in on this device, reported to the audit log. */
  unreported: number
}

function readThrottle(): Throttle {
  try {
    const raw = localStorage.getItem(THROTTLE_KEY)
    if (raw) return { failures: 0, lockedUntil: 0, unreported: 0, ...JSON.parse(raw) }
  } catch {
    /* storage unavailable */
  }
  return { failures: 0, lockedUntil: 0, unreported: 0 }
}

function writeThrottle(t: Throttle): void {
  try {
    localStorage.setItem(THROTTLE_KEY, JSON.stringify(t))
  } catch {
    /* storage unavailable */
  }
}

export function loginLockRemainingMs(): number {
  return Math.max(0, readThrottle().lockedUntil - Date.now())
}

function recordFailure(): void {
  const t = readThrottle()
  t.failures += 1
  t.unreported += 1
  if (t.failures >= MAX_ATTEMPTS) {
    t.lockedUntil = Date.now() + LOCK_MS
    t.failures = 0
  }
  writeThrottle(t)
}

/** Generic messages only — never reveal whether an email exists. */
export function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? ''
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return 'Incorrect email or password.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.'
    case 'auth/email-already-in-use':
      return 'Could not create an account with that email.'
    case 'auth/weak-password':
    case 'auth/password-does-not-meet-requirements':
      return 'Please choose a stronger password.'
    case 'auth/network-request-failed':
      return 'Network error. Check your connection.'
    case 'auth/requires-recent-login':
      return 'Please sign in again to continue.'
    default:
      return 'Authentication failed. Please try again.'
  }
}

export async function login(email: string, password: string, remember: boolean): Promise<void> {
  const remaining = loginLockRemainingMs()
  if (remaining > 0) {
    throw Object.assign(new Error('locked'), { code: 'auth/too-many-requests' })
  }
  await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence)
  try {
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password)
    const { unreported } = readThrottle()
    writeThrottle({ failures: 0, lockedUntil: 0, unreported: 0 })
    if (cred.user.emailVerified) {
      if (unreported > 0) {
        await logAudit(cred.user.uid, {
          action: 'auth.login_failed',
          entityType: 'auth',
          details: `${unreported} failed sign-in attempt(s) on this device before this login`,
        })
      }
      await logAudit(cred.user.uid, { action: 'auth.login', entityType: 'auth', details: 'Email/password sign-in' })
    }
  } catch (err) {
    recordFailure()
    throw err
  }
}

export async function register(displayName: string, email: string, password: string): Promise<void> {
  await setPersistence(auth, browserLocalPersistence)
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password)
  await updateProfile(cred.user, { displayName: displayName.trim() })
  await sendEmailVerification(cred.user)
}

export async function resendVerification(): Promise<void> {
  if (auth.currentUser) await sendEmailVerification(auth.currentUser)
}

/** Reload the user and force a fresh ID token so the email_verified claim reaches the rules. */
export async function refreshVerification(): Promise<boolean> {
  const user = auth.currentUser
  if (!user) return false
  await user.reload()
  if (user.emailVerified) {
    await user.getIdToken(true)
    await logAudit(user.uid, { action: 'auth.login', entityType: 'auth', details: 'Email verified' })
  }
  return user.emailVerified
}

export async function requestPasswordReset(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(auth, email.trim())
  } catch (err) {
    // Do not reveal whether the email is registered.
    const code = (err as { code?: string })?.code
    if (code !== 'auth/user-not-found' && code !== 'auth/invalid-email') throw err
  }
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const user = auth.currentUser
  if (!user?.email) throw new Error('Not signed in')
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, currentPassword))
  await updatePassword(user, newPassword)
  await logAudit(user.uid, { action: 'auth.password_changed', entityType: 'auth' })
}

export async function logout(): Promise<void> {
  const user = auth.currentUser
  if (user?.emailVerified) await logAudit(user.uid, { action: 'auth.logout', entityType: 'auth' })
  await signOut(auth)
}
