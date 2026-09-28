import type { KeyboardEvent } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { IconButton } from '../../components/ui'
import { cn } from '../../lib/cn'
import { CreditCardVisual } from '../accounts/CreditCardVisual'
import type { Account } from '../accounts/types'

interface Props {
  accounts: Account[]
  balances: Map<string, number>
  selectedId: string
  onSelect: (id: string) => void
}

/** How many cards peek out behind the front card. */
const PEEK = 2
const OFFSET_PX = 22

/**
 * Stacked, overlapping account cards. The front card is the "selected" one; the next
 * two peek out below it. Click a card behind, use ‹ › or the arrow keys to switch.
 */
export function CardStack({ accounts, balances, selectedId, onSelect }: Props) {
  const n = accounts.length
  const index = Math.max(0, accounts.findIndex((a) => a.id === selectedId))
  const go = (step: number) => onSelect(accounts[(index + step + n) % n].id)

  function onKey(e: KeyboardEvent) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      go(1)
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      go(-1)
    }
  }

  const visible = Math.min(n, PEEK + 1)

  return (
    <div>
      <div
        role="listbox"
        aria-label="Accounts"
        aria-activedescendant={`card-${accounts[index].id}`}
        tabIndex={0}
        onKeyDown={onKey}
        className="relative rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        style={{ paddingBottom: (visible - 1) * OFFSET_PX }}
      >
        {/* Sizing ghost keeps the container at card height. */}
        <div className="invisible aspect-[1.586] w-full" aria-hidden />
        {accounts.map((a, i) => {
          const depth = (i - index + n) % n // 0 = front
          if (depth > PEEK) return null
          return (
            <div
              key={a.id}
              id={`card-${a.id}`}
              role="option"
              aria-selected={depth === 0}
              onClick={() => depth !== 0 && onSelect(a.id)}
              className={cn('absolute inset-x-0 top-0 transition-all duration-300 ease-out', depth !== 0 && 'cursor-pointer hover:brightness-110')}
              style={{
                zIndex: 30 - depth,
                transform: `translateY(${depth * OFFSET_PX}px) scale(${1 - depth * 0.05})`,
                transformOrigin: 'bottom center',
                filter: depth ? `brightness(${1 - depth * 0.18})` : undefined,
              }}
            >
              <CreditCardVisual account={a} balance={balances.get(a.id) ?? a.openingBalance} />
            </div>
          )
        })}
      </div>

      {n > 1 && (
        <div className="mt-3 flex items-center justify-between gap-2">
          <IconButton label="Previous card" onClick={() => go(-1)}>
            <ChevronLeft size={16} />
          </IconButton>
          <div className="flex items-center gap-1.5" aria-hidden>
            {accounts.map((a, i) => (
              <button
                key={a.id}
                type="button"
                tabIndex={-1}
                onClick={() => onSelect(a.id)}
                className={cn('h-1.5 rounded-full transition-all', i === index ? 'w-5 bg-accent' : 'w-1.5 bg-line-strong hover:bg-ink-faint')}
              />
            ))}
          </div>
          <IconButton label="Next card" onClick={() => go(1)}>
            <ChevronRight size={16} />
          </IconButton>
        </div>
      )}
    </div>
  )
}
