import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn('glass min-w-0 rounded-3xl border border-line p-5 transition-[transform,border-color,box-shadow] duration-300 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[0_18px_40px_-24px_rgb(200_245_66/0.18)] sm:p-6', className)}>{children}</section>
}

export function CardHeader({ title, action, subtitle }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-sm font-medium text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-ink-faint">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
