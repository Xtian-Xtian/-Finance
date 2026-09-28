import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { onIdTokenChanged, type User } from 'firebase/auth'
import { auth } from '../../lib/firebase'
import { ensureProfile } from '../settings/profileService'

interface AuthState {
  user: User | null
  /** True once the user is verified and their profile exists. */
  ready: boolean
  initialising: boolean
  profileError: string | null
}

const AuthContext = createContext<AuthState>({ user: null, ready: false, initialising: true, profileError: null })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, ready: false, initialising: true, profileError: null })

  useEffect(() => {
    // onIdTokenChanged also fires after a forced token refresh (e.g. once email is verified).
    return onIdTokenChanged(auth, async (user) => {
      if (!user) {
        setState({ user: null, ready: false, initialising: false, profileError: null })
        return
      }
      if (!user.emailVerified) {
        setState({ user, ready: false, initialising: false, profileError: null })
        return
      }
      try {
        await ensureProfile(user)
        setState({ user, ready: true, initialising: false, profileError: null })
      } catch (err) {
        if (import.meta.env.DEV) console.error(err)
        setState({ user, ready: false, initialising: false, profileError: 'Could not load your profile.' })
      }
    })
  }, [])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  return useContext(AuthContext)
}
