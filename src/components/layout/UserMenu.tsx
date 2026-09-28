import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, LogOut } from 'lucide-react'
import { useAuth } from '../../features/auth/AuthProvider'
import { logout } from '../../features/auth/authService'
import { SECONDARY_NAV } from './navigation'

/** Profile chip with a dropdown for Settings, Security and Sign out. */
export function UserMenu() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const name = user?.displayName || user?.email?.split('@')[0] || 'Me'

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2.5 rounded-full border border-line bg-surface py-1 pr-3 pl-1 transition-colors hover:bg-surface-2"
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-surface-3 text-xs font-semibold text-ink" aria-hidden>
          {name.slice(0, 2).toUpperCase()}
        </span>
        <span className="hidden min-w-0 text-left md:block">
          <span className="block max-w-40 truncate text-sm leading-tight">{name}</span>
          <span className="block max-w-40 truncate text-[11px] leading-tight text-ink-faint">{user?.email}</span>
        </span>
        <ChevronDown size={14} className="text-ink-faint" aria-hidden />
      </button>
      {open && (
        <div role="menu" className="glass-strong absolute top-full right-0 z-50 mt-2 w-52 rounded-xl border border-line-strong p-1.5">
          {SECONDARY_NAV.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} role="menuitem" onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink-muted hover:bg-surface-3 hover:text-ink">
              <Icon size={15} aria-hidden />
              {label}
            </Link>
          ))}
          <div className="my-1 border-t border-line" />
          <button type="button" role="menuitem" onClick={() => void logout()} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink-muted hover:bg-surface-3 hover:text-negative">
            <LogOut size={15} aria-hidden />
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
