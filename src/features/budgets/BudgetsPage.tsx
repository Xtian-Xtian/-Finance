import { useMemo, useState, type FormEvent } from 'react'
import { ChevronLeft, ChevronRight, Copy, Pencil, Plus, Trash2, Wallet } from 'lucide-react'
import { Badge, Button, Card, ConfirmDialog, EmptyState, FormError, IconButton, Modal, MoneyField, PageHeader, ProgressBar, SelectField } from '../../components/ui'
import { useFinance } from '../../data/FinanceDataProvider'
import { formatMonthId, monthId, monthIdToDate } from '../../lib/dates'
import { formatMoney, parseMoney, sum, toMoneyInput } from '../../lib/money'
import { useAsyncAction } from '../../lib/useAsyncAction'
import { requirePositiveMoney } from '../../lib/validation'
import { budgetProgress, type BudgetProgress } from './budgetCalc'
import { copyBudgets, deleteBudget, saveBudget } from './budgetService'
import { STATUS_META } from './statusMeta'
import type { Budget } from './types'

function shiftMonth(id: string, n: number): string {
  const d = monthIdToDate(id)
  return monthId(new Date(d.getFullYear(), d.getMonth() + n, 1))
}

export function BudgetsPage() {
  const { uid, budgets, transactions, categories } = useFinance()
  const [month, setMonth] = useState(() => monthId(new Date()))
  const [editing, setEditing] = useState<Budget | null | undefined>(undefined) // undefined = closed, null = new
  const [deleting, setDeleting] = useState<Budget | null>(null)
  const copy = useAsyncAction()

  const progress = useMemo(
    () => budgets.filter((b) => b.month === month).map((b) => budgetProgress(b, transactions)).sort((a, b) => b.percentUsed - a.percentUsed),
    [budgets, transactions, month],
  )
  const previous = budgets.filter((b) => b.month === shiftMonth(month, -1))
  const totalLimit = sum(progress.map((p) => p.budget.limit))
  const totalSpent = sum(progress.map((p) => p.spent))
  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? 'Deleted category'
  const categoryColor = (id: string) => categories.find((c) => c.id === id)?.color ?? '#64748b'

  return (
    <>
      <PageHeader
        title="Budgets"
        description="Monthly spending limits per category."
        actions={
          <>
            {previous.length > 0 && (
              <Button icon={<Copy size={16} />} loading={copy.busy} onClick={() => copy.run(async () => void (await copyBudgets(uid, previous, month, budgets)))}>
                Copy last month
              </Button>
            )}
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => setEditing(null)}>
              Add budget
            </Button>
          </>
        }
      />
      <FormError message={copy.error} />

      <div className="mb-6 flex items-center gap-3">
        <IconButton label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))}>
          <ChevronLeft size={16} />
        </IconButton>
        <p className="min-w-40 text-center font-medium">{formatMonthId(month)}</p>
        <IconButton label="Next month" onClick={() => setMonth(shiftMonth(month, 1))}>
          <ChevronRight size={16} />
        </IconButton>
      </div>

      {progress.length > 0 && (
        <Card className="mb-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs text-ink-faint">Spent of total budget</p>
              <p className="tabular mt-1 text-2xl font-semibold">
                {formatMoney(totalSpent)} <span className="text-base font-normal text-ink-faint">/ {formatMoney(totalLimit)}</span>
              </p>
            </div>
            <p className={`tabular text-sm ${totalLimit - totalSpent < 0 ? 'text-negative' : 'text-ink-muted'}`}>
              {formatMoney(totalLimit - totalSpent)} remaining
            </p>
          </div>
          <div className="mt-4">
            <ProgressBar label="Total budget used" value={totalLimit ? (totalSpent / totalLimit) * 100 : 0} tone={totalSpent > totalLimit ? 'negative' : 'accent'} />
          </div>
        </Card>
      )}

      {progress.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {progress.map((p) => (
            <BudgetCard key={p.budget.id} p={p} name={categoryName(p.budget.categoryId)} color={categoryColor(p.budget.categoryId)} onEdit={() => setEditing(p.budget)} onDelete={() => setDeleting(p.budget)} />
          ))}
        </div>
      ) : (
        <EmptyState icon={<Wallet size={28} />} title={`No budgets for ${formatMonthId(month)}`} description="Set limits like Food ₱5,000 or Transportation ₱3,000." />
      )}

      <BudgetForm month={month} existing={editing ?? undefined} open={editing !== undefined} onClose={() => setEditing(undefined)} />
      <ConfirmDialog
        open={!!deleting}
        title="Delete budget?"
        message={deleting ? `Remove the ${categoryName(deleting.categoryId)} budget for ${formatMonthId(deleting.month)}? Transactions are not affected.` : ''}
        onConfirm={() => deleteBudget(uid, deleting!)}
        onClose={() => setDeleting(null)}
      />
    </>
  )
}

function BudgetCard({ p, name, color, onEdit, onDelete }: { p: BudgetProgress; name: string; color: string; onEdit: () => void; onDelete: () => void }) {
  const meta = STATUS_META[p.status]
  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-medium">
          <span className="size-2.5 rounded-full" style={{ background: color }} aria-hidden />
          {name}
        </p>
        <div className="flex items-center gap-1">
          <Badge tone={meta.tone}>{meta.label}</Badge>
          <IconButton label={`Edit ${name} budget`} onClick={onEdit}>
            <Pencil size={14} />
          </IconButton>
          <IconButton label={`Delete ${name} budget`} onClick={onDelete}>
            <Trash2 size={14} />
          </IconButton>
        </div>
      </div>
      <div className="mt-4">
        <ProgressBar label={`${name} budget used`} value={p.percentUsed} tone={meta.tone} />
      </div>
      <dl className="tabular mt-4 grid grid-cols-4 gap-2 text-xs">
        <div>
          <dt className="text-ink-faint">Budget</dt>
          <dd className="mt-0.5 text-ink">{formatMoney(p.budget.limit)}</dd>
        </div>
        <div>
          <dt className="text-ink-faint">Spent</dt>
          <dd className="mt-0.5 text-ink">{formatMoney(p.spent)}</dd>
        </div>
        <div>
          <dt className="text-ink-faint">Remaining</dt>
          <dd className={`mt-0.5 ${p.remaining < 0 ? 'text-negative' : 'text-ink'}`}>{formatMoney(p.remaining)}</dd>
        </div>
        <div>
          <dt className="text-ink-faint">Used</dt>
          <dd className="mt-0.5 text-ink">{p.percentUsed}%</dd>
        </div>
      </dl>
    </Card>
  )
}

function BudgetForm({ open, onClose, month, existing }: { open: boolean; onClose: () => void; month: string; existing?: Budget }) {
  const { uid, categories, budgets } = useFinance()
  const [categoryId, setCategoryId] = useState('')
  const [limit, setLimit] = useState('')
  const [errors, setErrors] = useState<{ categoryId?: string; limit?: string }>({})
  const { busy, error, run } = useAsyncAction()
  const [lastOpen, setLastOpen] = useState(false)

  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) {
      setCategoryId(existing?.categoryId ?? '')
      setLimit(existing ? toMoneyInput(existing.limit) : '')
      setErrors({})
    }
  }

  const used = new Set(budgets.filter((b) => b.month === month).map((b) => b.categoryId))
  const options = categories
    .filter((c) => c.type === 'expense' && (!used.has(c.id) || c.id === existing?.categoryId))
    .map((c) => ({ value: c.id, label: c.name }))

  async function submit(e: FormEvent) {
    e.preventDefault()
    const amount = parseMoney(limit)
    const next = { categoryId: categoryId ? undefined : 'Choose a category.', limit: requirePositiveMoney(amount, 'Budget') }
    setErrors(next)
    if (next.categoryId || next.limit) return
    await run(() => saveBudget(uid, existing?.month ?? month, categoryId, amount!), onClose)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={existing ? 'Edit budget' : `New budget · ${formatMonthId(month)}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="budget-form" loading={busy}>
            Save budget
          </Button>
        </>
      }
    >
      <form id="budget-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <SelectField label="Expense category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} options={options} placeholder="Select category" disabled={!!existing} error={errors.categoryId} />
        <MoneyField label="Monthly limit" value={limit} onChange={(e) => setLimit(e.target.value)} error={errors.limit} />
        <FormError message={error} />
      </form>
    </Modal>
  )
}
