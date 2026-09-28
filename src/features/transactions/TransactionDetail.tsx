import { useEffect, useState } from 'react'
import { ArrowLeftRight, ExternalLink, Pencil, Trash2 } from 'lucide-react'
import { Badge, Button, FormError, Modal, SelectField } from '../../components/ui'
import { useFinance } from '../../data/FinanceDataProvider'
import { formatDate, formatDateTime } from '../../lib/dates'
import { formatMoney } from '../../lib/money'
import { useAsyncAction } from '../../lib/useAsyncAction'
import { accountTypeLabel } from '../accounts/types'
import { draftFromTransaction, updateTransaction } from './transactionService'
import type { Transaction } from './types'

interface Props {
  transaction: Transaction | null
  onClose: () => void
  onEdit: (t: Transaction) => void
  onDelete: (t: Transaction) => void
}

const TYPE_TONE = { income: 'positive', expense: 'negative', transfer: 'accent', adjustment: 'neutral' } as const
const TYPE_LABEL = { income: 'Income', expense: 'Expense', transfer: 'Transfer', adjustment: 'Adjustment' } as const

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 py-2 text-sm">
      <dt className="text-ink-faint">{label}</dt>
      <dd className="min-w-0 break-words text-ink">{children}</dd>
    </div>
  )
}

export function TransactionDetail({ transaction: t, onClose, onEdit, onDelete }: Props) {
  const { uid, accounts, categories } = useFinance()
  const [otherAccountId, setOtherAccountId] = useState('')
  const { busy, error, setError, run } = useAsyncAction()

  useEffect(() => {
    setOtherAccountId('')
    setError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t?.id])

  if (!t) return <Modal open={false} title="" onClose={onClose}>{null}</Modal>

  const account = (id: string) => accounts.find((a) => a.id === id)
  const accountLabel = (id: string) => {
    const a = account(id)
    return a ? `${a.name} · ${accountTypeLabel(a.type)}${a.lastFour ? ` •••• ${a.lastFour}` : ''}` : 'Deleted account'
  }
  const category = t.type === 'income' || t.type === 'expense' ? categories.find((c) => c.id === t.categoryId) : undefined
  const gmailId = t.source === 'gmail' && t.id.startsWith('gmail_') ? t.id.slice(6) : null
  const canConvert = t.type === 'income' || t.type === 'expense'
  const thisAccountId = t.type === 'transfer' ? t.fromAccountId : t.accountId

  const signed =
    t.type === 'income' ? `+${formatMoney(t.amount)}` : t.type === 'expense' ? `-${formatMoney(t.amount)}` : formatMoney(t.amount)

  async function convertToTransfer() {
    if (!t || !canConvert || !otherAccountId) return
    const draft = draftFromTransaction(t)
    // Income: money came FROM the other account INTO this one. Expense: this account TO the other.
    const next =
      t.type === 'income'
        ? { ...draft, type: 'transfer' as const, accountId: otherAccountId, toAccountId: t.accountId, categoryId: '' }
        : { ...draft, type: 'transfer' as const, accountId: t.accountId, toAccountId: otherAccountId, categoryId: '' }
    await run(() => updateTransaction(uid, t.id, next, accounts, categories), onClose)
  }

  return (
    <Modal
      open={!!t}
      onClose={onClose}
      title="Transaction details"
      footer={
        <>
          <Button variant="danger" icon={<Trash2 size={14} />} onClick={() => onDelete(t)}>
            Delete
          </Button>
          <Button variant="primary" icon={<Pencil size={14} />} onClick={() => onEdit(t)}>
            Edit
          </Button>
        </>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone={TYPE_TONE[t.type]}>{TYPE_LABEL[t.type]}</Badge>
        {t.source === 'gmail' && <Badge tone="accent">Imported from Gmail</Badge>}
      </div>
      <p className={`tabular text-3xl font-semibold ${t.type === 'income' ? 'text-positive' : ''}`}>{signed}</p>
      <p className="mt-1 text-sm text-ink-muted">{t.description}</p>

      <dl className="mt-4 divide-y divide-line border-y border-line">
        <Row label="Date">{formatDate(t.date)}</Row>
        {t.type === 'transfer' ? (
          <>
            <Row label="From">{accountLabel(t.fromAccountId)}</Row>
            <Row label="To">{accountLabel(t.toAccountId)}</Row>
          </>
        ) : (
          <Row label="Account">{accountLabel(t.accountId)}</Row>
        )}
        {canConvert && (
          <Row label="Category">
            <span className="flex items-center gap-2">
              {category && <span className="size-2 rounded-full" style={{ background: category.color }} aria-hidden />}
              {category?.name ?? 'Uncategorised'}
            </span>
          </Row>
        )}
        <Row label="Counts as">
          {t.type === 'income' && 'Income (increases income totals)'}
          {t.type === 'expense' && 'Expense (increases spending and budgets)'}
          {t.type === 'transfer' && 'Transfer — not income or expense; net worth unchanged'}
          {t.type === 'adjustment' && 'Balance correction — not income or expense'}
        </Row>
        {t.notes && (
          <Row label="Notes">
            <span className="text-xs whitespace-pre-line text-ink-muted">{t.notes}</span>
          </Row>
        )}
        <Row label="Recorded">{formatDateTime(t.createdAt)}</Row>
        {t.updatedAt && t.createdAt && t.updatedAt.getTime() - t.createdAt.getTime() > 1000 && <Row label="Last edited">{formatDateTime(t.updatedAt)}</Row>}
      </dl>

      {gmailId && (
        <a
          href={`https://mail.google.com/mail/u/0/#all/${encodeURIComponent(gmailId)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
        >
          Open original email <ExternalLink size={14} aria-hidden />
        </a>
      )}

      {canConvert && (
        <div className="mt-5 rounded-xl border border-line bg-surface-2/50 p-4">
          <p className="flex items-center gap-2 text-sm font-medium">
            <ArrowLeftRight size={14} className="text-accent" aria-hidden />
            Is this money moving between your own accounts?
          </p>
          <p className="mt-1 text-xs text-ink-faint">
            {t.type === 'income'
              ? `Pick the account the money came from. It will stop counting as income.`
              : `Pick the account the money went to (e.g. your credit card or GCash). It will stop counting as an expense.`}
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <SelectField
              className="min-w-48 flex-1"
              label={t.type === 'income' ? 'Came from' : 'Went to'}
              value={otherAccountId}
              onChange={(e) => setOtherAccountId(e.target.value)}
              options={accounts.filter((a) => a.id !== thisAccountId && a.status === 'active').map((a) => ({ value: a.id, label: `${a.name} (${accountTypeLabel(a.type)})` }))}
              placeholder="Select account"
            />
            <Button variant="primary" loading={busy} disabled={!otherAccountId} onClick={convertToTransfer}>
              Convert to transfer
            </Button>
          </div>
          <div className="mt-2">
            <FormError message={error} />
          </div>
        </div>
      )}
    </Modal>
  )
}
