import { useEffect, useRef, useState } from 'react'
import { Check, Monitor, Moon, Sun } from 'lucide-react'
import { cn } from '../../lib/cn'
import { useTheme, type ThemePreference } from '../../app/ThemeProvider'

const OPTIONS: Array<{ value: ThemePreference; label: string; icon: typeof Sun }> = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

/** Top-bar button: shows the current theme and opens a Light / Dark / System menu. */
export function ThemeToggle({ className }: { className?: string }) {
  const { preference, resolved, setPreference } = useTheme()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const Icon = resolved === 'light' ? Sun : Moon

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
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
        aria-label={`Theme: ${OPTIONS.find((o) => o.value === preference)?.label}`}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink',
          className,
        )}
      >
        <Icon size={16} />
      </button>
      {open && (
        <div role="menu" className="glass-strong absolute top-full right-0 z-50 mt-2 w-44 rounded-xl border border-line-strong p-1.5">
          {OPTIONS.map(({ value, label, icon: OptIcon }) => (
            <button
              key={value}
              type="button"
              role="menuitemradio"
              aria-checked={preference === value}
              onClick={() => {
                const r = ref.current?.getBoundingClientRect()
                setPreference(value, r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : undefined)
                setOpen(false)
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink-muted hover:bg-surface-3 hover:text-ink"
            >
              <OptIcon size={15} aria-hidden />
              <span className="flex-1 text-left">{label}</span>
              {preference === value && <Check size={14} className="text-accent" aria-hidden />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
