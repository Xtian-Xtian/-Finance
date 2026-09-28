import { useId, useState, type CSSProperties } from 'react'
import { Banknote, Eye, EyeOff, Landmark, TrendingUp, Wallet, Wifi, type LucideIcon } from 'lucide-react'
import { formatMoney } from '../../lib/money'
import { creditCardUsage } from './accountCalc'
import type { Account, AccountType } from './types'

type Theme = 'bpi' | 'billease' | 'gcash' | 'maya' | 'default'

const THEMES: Record<Theme, CSSProperties> = {
  // Deep maroon with red light streaks radiating from the right, like the BPI debit card.
  bpi: {
    backgroundColor: '#2b0407',
    backgroundImage: [
      'radial-gradient(90% 70% at 72% 45%, rgba(200, 30, 36, 0.45) 0%, rgba(110, 12, 18, 0.25) 40%, transparent 75%)',
      'repeating-conic-gradient(from 230deg at 95% 45%, rgba(255, 70, 70, 0.07) 0deg 2deg, transparent 2deg 9deg)',
      'linear-gradient(160deg, #1f0305 0%, #4a080d 40%, #6b0d13 58%, #2b0407 100%)',
    ].join(', '),
  },
  billease: {
    backgroundColor: '#061a33',
    backgroundImage: [
      'radial-gradient(90% 80% at 80% 20%, rgba(56, 189, 248, 0.35) 0%, transparent 60%)',
      'radial-gradient(70% 60% at 10% 100%, rgba(45, 212, 191, 0.25) 0%, transparent 60%)',
      'linear-gradient(150deg, #04142a 0%, #0b2e5c 55%, #061a33 100%)',
    ].join(', '),
  },
  gcash: {
    backgroundImage: 'radial-gradient(80% 80% at 85% 15%, rgba(96, 165, 250, 0.45) 0%, transparent 60%), linear-gradient(150deg, #0a2a6b 0%, #1d4ed8 60%, #0a2a6b 100%)',
  },
  maya: {
    backgroundImage: 'radial-gradient(80% 80% at 85% 15%, rgba(74, 222, 128, 0.35) 0%, transparent 60%), linear-gradient(150deg, #052e16 0%, #0f5132 60%, #052e16 100%)',
  },
  default: {
    backgroundImage: 'linear-gradient(135deg, #3f3f46 0%, #27272a 50%, #09090b 100%)',
  },
}

function themeFor(account: Account): Theme {
  const hay = `${account.name} ${account.institution ?? ''}`
  if (/billease/i.test(hay)) return 'billease'
  if (/gcash/i.test(hay)) return 'gcash'
  if (/maya|paymaya/i.test(hay)) return 'maya'
  if (/bpi/i.test(hay)) return 'bpi'
  return 'default'
}

const KIND: Record<AccountType, string> = {
  credit_card: 'Credit',
  bank: 'Debit',
  ewallet: 'E-wallet',
  cash: 'Cash',
  investment: 'Invest',
  loan: 'Loan',
}

const ICON: Partial<Record<AccountType, LucideIcon>> = { cash: Banknote, ewallet: Wallet, investment: TrendingUp, loan: Landmark }

const BRAND: Partial<Record<Theme, string>> = { bpi: 'BPI', billease: 'BillEase', gcash: 'GCash', maya: 'Maya' }

function Chip() {
  const id = useId()
  return (
    <svg viewBox="0 0 50 38" className="h-9 w-12 drop-shadow" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f7e08a" />
          <stop offset="50%" stopColor="#d4a93c" />
          <stop offset="100%" stopColor="#f3d77a" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="48" height="36" rx="6" fill={`url(#${id})`} stroke="#a67c1f" strokeWidth="1" />
      <path d="M1 13h14M1 25h14M35 13h14M35 25h14M15 1v36M35 1v36M15 19h20" stroke="#9c7420" strokeWidth="1.2" fill="none" />
      <ellipse cx="25" cy="19" rx="7" ry="9" fill="none" stroke="#9c7420" strokeWidth="1.2" />
    </svg>
  )
}

function AccountIcon({ type }: { type: AccountType }) {
  const Icon = ICON[type] ?? Wallet
  return (
    <span className="flex h-9 w-12 items-center justify-center rounded-lg border border-white/20 bg-white/10 backdrop-blur-sm" aria-hidden>
      <Icon size={20} className="text-white/90" />
    </span>
  )
}

/**
 * Decorative account card. Shows only safe fields: nickname/issuer and the masked
 * last four digits — never the full number, expiry or CVV.
 */
export function CreditCardVisual({ account, balance }: { account: Account; balance: number }) {
  const theme = themeFor(account)
  const kind = KIND[account.type]
  const brand = BRAND[theme] ?? (account.institution || account.name).slice(0, 14)
  const physical = account.type === 'credit_card' || account.type === 'bank'
  // Card names are hidden by default (privacy for screenshots / screen-sharing).
  const [showName, setShowName] = useState(false)
  const hidden = 'blur-[6px] select-none transition-[filter] duration-300'
  const shown = 'transition-[filter] duration-300'

  let infoLabel = 'Balance'
  let infoValue = formatMoney(balance)
  if (account.type === 'credit_card') {
    const usage = creditCardUsage(account, balance)
    infoLabel = 'Credit limit'
    infoValue = usage.limit > 0 ? formatMoney(usage.limit) : 'Not set'
  } else if (account.type === 'loan') {
    infoLabel = 'Amount owed'
    infoValue = formatMoney(Math.max(0, -balance))
  }

  return (
    <div
      className="@container relative aspect-[1.586] w-full overflow-hidden rounded-2xl border border-white/10 p-[6%] text-white shadow-xl shadow-black/50 select-none"
      style={THEMES[theme]}
      role="group"
      aria-label={`${showName ? account.name : 'Hidden'} ${kind} card${account.lastFour ? ` ending ${account.lastFour}` : ''}, ${infoLabel.toLowerCase()} ${infoValue}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-white/10 via-transparent to-black/30" aria-hidden />

      <div className="relative flex h-full flex-col">
        <div className="flex items-start justify-between gap-2">
          <p className="flex min-w-0 items-baseline gap-2 leading-none">
            <span className={`truncate text-[clamp(1.1rem,5.5cqw,1.75rem)] font-extrabold tracking-tight ${showName ? shown : hidden}`} aria-hidden={!showName}>
              {brand}
            </span>
            <span className="shrink-0 text-[clamp(0.85rem,4cqw,1.35rem)] font-semibold">{kind}</span>
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setShowName((v) => !v)
              }}
              aria-pressed={showName}
              aria-label={showName ? 'Hide card name' : 'Show card name'}
              title={showName ? 'Hide card name' : 'Show card name'}
              className="flex size-7 items-center justify-center rounded-full bg-black/25 text-white/80 backdrop-blur-sm transition-colors hover:bg-black/40 hover:text-white"
            >
              {showName ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
            {physical && <Wifi size={18} className="rotate-90 text-white/70" aria-hidden />}
          </div>
        </div>

        <div className="mt-[7%]">{physical ? <Chip /> : <AccountIcon type={account.type} />}</div>

        <p className="tabular mt-[5%] truncate font-mono text-[clamp(0.95rem,4.6cqw,1.5rem)] tracking-[0.12em] text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]">
          {account.lastFour ? (
            `•••• •••• •••• ${account.lastFour}`
          ) : (
            <span className={showName ? shown : hidden} aria-hidden={!showName}>
              {account.name.toUpperCase()}
            </span>
          )}
        </p>

        <div className="mt-auto flex items-end justify-between gap-3">
          <p className="flex min-w-0 items-center gap-2">
            <span className="text-[8px] leading-[1.1] font-medium text-white/70 uppercase">
              {infoLabel.split(' ').map((w) => (
                <span key={w} className="block">
                  {w}
                </span>
              ))}
            </span>
            <span className="tabular truncate text-sm font-semibold">{infoValue}</span>
          </p>
          <span className="shrink-0 rounded-md bg-white px-2.5 py-1 text-sm font-extrabold tracking-tight text-red-700 uppercase italic shadow">
            {kind}
          </span>
        </div>
      </div>
    </div>
  )
}
