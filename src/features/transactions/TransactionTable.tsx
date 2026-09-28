import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Eye, Pencil, SlidersHorizontal, Trash2 } from 'lucide-react'
import { Badge, IconButton } from '../../components/ui'
import { useFinance } from '../../data/FinanceDataProvider'
import { formatDate } from '../../lib/dates'
import { formatMoney } from '../../lib/money'
import type { Transaction } from './types'

interface Props {
  transactions: Transaction[]
  onEdit?: (t: Transaction) => void
  onDelete?: (t: Transaction) => void
  /** Opens the detail view (row click / eye button). */
  onView?: (t: Transaction) => void
  compact?: boolean
}

const TYPE_META = {
  income: { icon: ArrowDownLeft, tone: 'positive', label: 'Income' },
  expense: { icon: ArrowUpRight, tone: 'negative', label: 'Expense' },
  transfer: { icon: ArrowLeftRight, tone: 'accent', label: 'Transfer' },
  adjustment: { icon: SlidersHorizontal, tone: 'neutral', label: 'Adjustment' },
} as const

export function TransactionTable({ transactions, onEdit, onDelete, onView, compact }: Props) {
  const { accounts, categories } = useFinance()
  const accountName = (id: string) => accounts.find((a) => a.id === id)?.name ?? 'Deleted account'
  const category = (id: string) => categories.find((c) => c.id === id)

  function detail(t: Transaction): { label: string; color?: string } {
    if (t.type === 'transfer') return { label: `${accountName(t.fromAccountId)} → ${accountName(t.toAccountId)}` }
    if (t.type === 'adjustment') return { label: accountName(t.accountId) }
    const c = category(t.categoryId)
    return { label: c?.name ?? 'Uncategorised', color: c?.color }
  }

  function signedAmount(t: Transaction) {
    if (t.type === 'income') return { text: `+${formatMoney(t.amount)}`, cls: 'text-positive' }
    if (t.type === 'expense') return { text: `-${formatMoney(t.amount)}`, cls: 'text-ink' }
    if (t.type === 'adjustment') return { text: `${t.amount > 0 ? '+' : ''}${formatMoney(t.amount)}`, cls: 'text-ink-muted' }
    return { text: formatMoney(t.amount), cls: 'text-ink-muted' }
  }

  return (
    <div className="relative overflow-x-auto rounded-xl border border-line">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="bg-surface-2 text-left text-xs text-ink-faint">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">Description</th>
            <th scope="col" className="px-4 py-3 font-medium">Category / Accounts</th>
            {!compact && <th scope="col" className="px-4 py-3 font-medium">Account</th>}
            <th scope="col" className="px-4 py-3 font-medium">Date</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">Amount</th>
            <th scope="col" className="px-4 py-3 font-medium">Type</th>
            {(onEdit || onDelete || onView) && (
              <th scope="col" className="px-4 py-3">
                <span className="sr-only">Actions</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {transactions.map((t) => {
            const meta = TYPE_META[t.type]
            const Icon = meta.icon
            const d = detail(t)
            const amt = signedAmount(t)
            return (
              <tr key={t.id} onClick={onView ? () => onView(t) : undefined} className={`hover:bg-surface-2/60 ${onView ? 'cursor-pointer' : ''}`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-line bg-surface-3 text-ink-muted">
                      <Icon size={14} aria-hidden />
                    </span>
                    {onView ? (
                      <button type="button" onClick={(e) => { e.stopPropagation(); onView(t) }} className="max-w-[16rem] truncate text-left hover:text-accent" title={t.description}>
                        {t.description}
                      </button>
                    ) : (
                      <span className="max-w-[16rem] truncate" title={t.description}>
                        {t.description}
                      </span>
                    )}
                    {t.source === 'gmail' && <Badge tone="accent">Imported</Badge>}
                  </div>
                </td>
                <td className="px-4 py-3 text-ink-muted">
                  <span className="flex items-center gap-2">
                    {d.color && <span className="size-2 shrink-0 rounded-full" style={{ background: d.color }} aria-hidden />}
                    <span className="truncate">{d.label}</span>
                  </span>
                </td>
                {!compact && <td className="px-4 py-3 text-ink-muted">{t.type === 'transfer' ? '—' : accountName(t.accountId)}</td>}
                <td className="px-4 py-3 whitespace-nowrap text-ink-muted">{formatDate(t.date)}</td>
                <td className={`tabular px-4 py-3 text-right whitespace-nowrap ${amt.cls}`}>{amt.text}</td>
                <td className="px-4 py-3">
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                </td>
                {(onEdit || onDelete || onView) && (
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      {onView && (
                        <IconButton label={`View details of ${t.description}`} onClick={() => onView(t)}>
                          <Eye size={14} />
                        </IconButton>
                      )}
                      {onEdit && (
                        <IconButton label={`Edit ${t.description}`} onClick={() => onEdit(t)}>
                          <Pencil size={14} />
                        </IconButton>
                      )}
                      {onDelete && (
                        <IconButton label={`Delete ${t.description}`} onClick={() => onDelete(t)}>
                          <Trash2 size={14} />
                        </IconButton>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
