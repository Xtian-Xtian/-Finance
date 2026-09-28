import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

type Tone = 'positive' | 'negative' | 'warning' | 'neutral' | 'accent'

const TONES: Record<Tone, string> = {
  positive: 'bg-positive/12 text-positive border-positive/30',
  negative: 'bg-negative/12 text-negative border-negative/30',
  warning: 'bg-warning/12 text-warning border-warning/30',
  neutral: 'bg-surface-3 text-ink-muted border-line-strong',
  accent: 'bg-accent-soft text-accent border-accent/30',
}

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap', TONES[tone])}>
      {children}
    </span>
  )
}

export function ProgressBar({ value, tone = 'accent', label }: { value: number; tone?: Tone; label: string }) {
  const pct = Math.max(0, Math.min(100, value))
  const color =
    tone === 'negative' ? 'bg-negative' : tone === 'warning' ? 'bg-warning' : tone === 'positive' ? 'bg-positive' : 'bg-accent'
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value)}
      className="h-2 w-full overflow-hidden rounded-full bg-surface-3"
    >
      <div className={cn('grow-x h-full rounded-full transition-[width]', color)} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line px-6 py-10 text-center">
      {icon && <div className="mb-1 text-ink-faint">{icon}</div>}
      <p className="text-sm font-medium text-ink">{title}</p>
      {description && <p className="max-w-sm text-xs text-ink-faint">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 p-10 text-sm text-ink-muted">
      <span className="size-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      {label}…
    </div>
  )
}

export function Notice({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <div className={cn('rounded-xl border px-4 py-3 text-sm', TONES[tone])}>{children}</div>
}
