import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Notice, Spinner } from '../components/ui'
import { useAuth } from '../features/auth/AuthProvider'
import { logout } from '../features/auth/authService'

/**
 * UX-only routing guard. Real protection is enforced by Firestore Security Rules
 * (request.auth.uid == userId && email_verified) — never by the frontend.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, ready, initialising, profileError } = useAuth()
  const location = useLocation()

  if (initialising) return <Spinner label="Checking your session" />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (!user.emailVerified) return <Navigate to="/verify-email" replace />
  if (profileError) {
    return (
      <div className="mx-auto mt-20 max-w-md space-y-3 px-4">
        <Notice tone="negative">{profileError}</Notice>
        <button type="button" className="text-sm text-accent" onClick={() => void logout()}>
          Sign out
        </button>
      </div>
    )
  }
  if (!ready) return <Spinner label="Preparing your workspace" />
  return <>{children}</>
}

/** For login/register pages: bounce signed-in users to the right place. */
export function PublicOnly({ children }: { children: ReactNode }) {
  const { user, initialising } = useAuth()
  const location = useLocation()
  if (initialising) return <Spinner label="Checking your session" />
  if (user && !user.emailVerified) return <Navigate to="/verify-email" replace />
  if (user) {
    const from = (location.state as { from?: string } | null)?.from
    return <Navigate to={from && from.startsWith('/') && !from.startsWith('//') ? from : '/'} replace />
  }
  return <>{children}</>
}

export function RequireUnverified({ children }: { children: ReactNode }) {
  const { user, initialising } = useAuth()
  if (initialising) return <Spinner label="Checking your session" />
  if (!user) return <Navigate to="/login" replace />
  if (user.emailVerified) return <Navigate to="/" replace />
  return <>{children}</>
}
