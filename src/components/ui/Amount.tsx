import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { useCountUp } from '../../lib/useCountUp'

const whole = new Intl.NumberFormat('en-PH', { maximumFractionDigits: 0 })
const compact = new Intl.NumberFormat('en-PH', { notation: 'compact', maximumFractionDigits: 1 })

interface AmountProps {
  /** Integer centavos. */
  centavos: number
  /** Font-size classes, e.g. "text-5xl". The ₱ and cents scale with it. */
  className?: string
  /** Show 42.6K instead of 42,600.00. */
  compactValue?: boolean
  /** Prefix a + for positive values. */
  signed?: boolean
}

/**
 * Display amount in the dashboard style: small raised ₱, large light digits, small dimmed cents.
 * Screen readers get the plain formatted value.
 */
export function Amount({ centavos, className, compactValue, signed }: AmountProps) {
  const final = centavos || 0
  const value = useCountUp(final)
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : signed && value > 0 ? '+' : ''
  const fAbs = Math.abs(final)
  const plain = `${final < 0 ? '-' : signed && final > 0 ? '+' : ''}₱${compactValue ? compact.format(fAbs / 100) : `${whole.format(Math.floor(fAbs / 100))}.${String(fAbs % 100).padStart(2, '0')}`}`
  return (
    <span className={cn('display-num inline-flex items-start whitespace-nowrap', className)}>
      <span className="sr-only">{plain}</span>
      <span className="mt-[0.1em] mr-[0.06em] text-[0.46em] font-normal" aria-hidden>
        {sign}₱
      </span>
      <span aria-hidden>{compactValue ? compact.format(abs / 100).replace(/[A-Z]$/, '') : whole.format(Math.floor(abs / 100))}</span>
      <span className="mb-[0.06em] self-end text-[0.46em] font-normal text-ink-muted" aria-hidden>
        {compactValue ? (compact.format(abs / 100).match(/[A-Z]$/)?.[0] ?? '') : `.${String(abs % 100).padStart(2, '0')}`}
      </span>
    </span>
  )
}

/** Small rounded pill, e.g. "↗ Net this month +₱9,420". */
export function Chip({ icon, children, className }: { icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[11px] whitespace-nowrap text-ink-muted', className)}>
      {icon}
      {children}
    </span>
  )
}
