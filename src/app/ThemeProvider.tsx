import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { flushSync } from 'react-dom'

export type ThemePreference = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'
/** Screen point the theme-change reveal grows from (e.g. the toggle button). */
export type ThemeOrigin = { x: number; y: number }

// Must match public/theme-init.js, which applies the theme before React loads (no flash).
const STORAGE_KEY = 'pf.theme'
const META_COLORS: Record<ResolvedTheme, string> = { dark: '#050507', light: '#f4f5f7' }

function readPreference(): ThemePreference {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'light' || v === 'dark' || v === 'system' ? v : 'system'
  } catch {
    return 'system'
  }
}

function systemTheme(): ResolvedTheme {
  try {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

function reducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

function apply(theme: ResolvedTheme) {
  const root = document.documentElement
  root.dataset.theme = theme
  root.style.colorScheme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', META_COLORS[theme])
}

/** Fallback animation: cross-fade colours for a moment (browsers without View Transitions). */
function fadeColours() {
  const root = document.documentElement
  root.classList.add('theme-fade')
  window.setTimeout(() => root.classList.remove('theme-fade'), 450)
}

type ViewTransitionDocument = Document & { startViewTransition?: (update: () => void) => unknown }

interface ThemeState {
  preference: ThemePreference
  resolved: ResolvedTheme
  setPreference: (p: ThemePreference, origin?: ThemeOrigin) => void
}

const ThemeContext = createContext<ThemeState>({ preference: 'system', resolved: 'dark', setPreference: () => {} })

/** Light / dark / follow-the-system theme, remembered per device, with an animated switch. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPref] = useState<ThemePreference>(readPreference)
  const [system, setSystem] = useState<ResolvedTheme>(systemTheme)
  const resolved: ResolvedTheme = preference === 'system' ? system : preference
  const applied = useRef<ResolvedTheme | null>(null)

  // Follow OS changes live (e.g. the phone switching to dark at sunset).
  useEffect(() => {
    let mq: MediaQueryList
    try {
      mq = window.matchMedia('(prefers-color-scheme: light)')
    } catch {
      return
    }
    const onChange = () => setSystem(mq.matches ? 'light' : 'dark')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // Keep <html> in sync. Changes not started from setPreference (e.g. the OS switching) fade.
  useEffect(() => {
    if (applied.current === resolved) return
    if (applied.current !== null && !reducedMotion()) fadeColours()
    apply(resolved)
    applied.current = resolved
  }, [resolved])

  function setPreference(p: ThemePreference, origin?: ThemeOrigin) {
    try {
      localStorage.setItem(STORAGE_KEY, p)
    } catch {
      /* storage unavailable — the choice lasts for this visit only */
    }
    const next: ResolvedTheme = p === 'system' ? system : p
    const doc = document as ViewTransitionDocument
    if (next === resolved || reducedMotion() || typeof doc.startViewTransition !== 'function') {
      setPref(p)
      return
    }
    // Circular reveal of the new theme from the clicked point (or the screen centre).
    const root = document.documentElement
    root.style.setProperty('--vt-x', `${origin?.x ?? window.innerWidth / 2}px`)
    root.style.setProperty('--vt-y', `${origin?.y ?? window.innerHeight / 2}px`)
    doc.startViewTransition(() => {
      flushSync(() => setPref(p))
      apply(next)
      applied.current = next
    })
  }

  return <ThemeContext.Provider value={{ preference, resolved, setPreference }}>{children}</ThemeContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme(): ThemeState {
  return useContext(ThemeContext)
}
