import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { CalendarClock, Check, Pencil, Plus, Trash2 } from 'lucide-react'
import { Badge, Button, Card, ConfirmDialog, EmptyState, FormError, IconButton, Modal, MoneyField, PageHeader, Segmented, SelectField, TextField } from '../../components/ui'
import { useFinance } from '../../data/FinanceDataProvider'
import { formatDate, fromDateInput, toDateInput } from '../../lib/dates'
import { formatMoney, parseMoney, sum, toMoneyInput } from '../../lib/money'
import { useAsyncAction } from '../../lib/useAsyncAction'
import { hasErrors, requireBusinessDate, requirePositiveMoney, requireText, type Errors } from '../../lib/validation'
import { billStatus, daysUntilDue, sortBills } from './billCalc'
import { createBill, deleteBill, markBillPaid, updateBill } from './billService'
import { BILL_STATUS_META } from './statusMeta'
import { BILL_FREQUENCIES, BILL_KINDS, type Bill, type BillFrequency, type BillKind, type BillStatus } from './types'

type Filter = 'all' | BillStatus

export function BillsPage() {
  const { uid, bills } = useFinance()
  const [filter, setFilter] = useState<Filter>('all')
  const [editing, setEditing] = useState<Bill | null | undefined>(undefined)
  const [paying, setPaying] = useState<Bill | null>(null)
  const [deleting, setDeleting] = useState<Bill | null>(null)

  const sorted = useMemo(() => sortBills(bills), [bills])
  const visible = filter === 'all' ? sorted : sorted.filter((b) => billStatus(b) === filter)
  const unpaid = bills.filter((b) => billStatus(b) !== 'paid')
  const count = (s: BillStatus) => bills.filter((b) => billStatus(b) === s).length

  return (
    <>
      <PageHeader
        title="Bills"
        description="Rent, utilities, internet, phone, loans, cards and subscriptions."
        actions={
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setEditing(null)}>
            Add bill
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {(['overdue', 'due_today', 'upcoming', 'paid'] as BillStatus[]).map((s) => (
          <Card key={s}>
            <p className="text-xs text-ink-faint">{BILL_STATUS_META[s].label}</p>
            <p className="tabular mt-1 text-2xl font-semibold">{count(s)}</p>
          </Card>
        ))}
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Segmented
            label="Filter bills"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'All' },
              { value: 'overdue', label: 'Overdue' },
              { value: 'due_today', label: 'Today' },
              { value: 'upcoming', label: 'Upcoming' },
              { value: 'paid', label: 'Paid' },
            ]}
          />
          <p className="tabular text-sm text-ink-muted">Unpaid total: {formatMoney(sum(unpaid.map((b) => b.amount)))}</p>
        </div>
        {visible.length ? (
          <ul className="divide-y divide-line">
            {visible.map((b) => {
              const status = billStatus(b)
              const days = daysUntilDue(b)
              return (
                <li key={b.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{b.name}</p>
                    <p className="text-xs text-ink-faint">
                      {BILL_KINDS.find((k) => k.value === b.kind)?.label} · {BILL_FREQUENCIES.find((f) => f.value === b.frequency)?.label} · due {formatDate(b.dueDate)}
                      {status === 'upcoming' && ` (in ${days} day${days === 1 ? '' : 's'})`}
                      {status === 'overdue' && ` (${-days} day${days === -1 ? '' : 's'} late)`}
                      {b.lastPaidAt && ` · last paid ${formatDate(b.lastPaidAt)}`}
                    </p>
                  </div>
                  <span className="tabular font-medium">{formatMoney(b.amount)}</span>
                  <Badge tone={BILL_STATUS_META[status].tone}>{BILL_STATUS_META[status].label}</Badge>
                  <div className="flex gap-1">
                    {status !== 'paid' && (
                      <Button size="sm" icon={<Check size={14} />} onClick={() => setPaying(b)}>
                        Mark paid
                      </Button>
                    )}
                    <IconButton label={`Edit ${b.name}`} onClick={() => setEditing(b)}>
                      <Pencil size={14} />
                    </IconButton>
                    <IconButton label={`Delete ${b.name}`} onClick={() => setDeleting(b)}>
                      <Trash2 size={14} />
                    </IconButton>
                  </div>
                </li>
              )
            })}
          </ul>
        ) : (
          <EmptyState icon={<CalendarClock size={28} />} title="No bills here" description="Add recurring bills to get reminders of what's due." />
        )}
      </Card>

      <BillForm open={editing !== undefined} existing={editing ?? undefined} onClose={() => setEditing(undefined)} />
      <PayBillForm bill={paying} onClose={() => setPaying(null)} />
      <ConfirmDialog open={!!deleting} title="Delete bill?" message={`"${deleting?.name}" will be deleted. Past payment transactions are kept.`} onConfirm={() => deleteBill(uid, deleting!)} onClose={() => setDeleting(null)} />
    </>
  )
}

function BillForm({ open, onClose, existing }: { open: boolean; onClose: () => void; existing?: Bill }) {
  const { uid, accounts, categories } = useFinance()
  const [form, setForm] = useState({ name: '', kind: 'other' as BillKind, amount: '', dueDate: '', frequency: 'monthly' as BillFrequency, accountId: '', categoryId: '' })
  const [errors, setErrors] = useState<Errors>({})
  const { busy, error, setError, run } = useAsyncAction()

  useEffect(() => {
    if (!open) return
    setForm({
      name: existing?.name ?? '',
      kind: existing?.kind ?? 'other',
      amount: existing ? toMoneyInput(existing.amount) : '',
      dueDate: toDateInput(existing?.dueDate ?? new Date()),
      frequency: existing?.frequency ?? 'monthly',
      accountId: existing?.accountId ?? '',
      categoryId: existing?.categoryId ?? '',
    })
    setErrors({})
    setError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existing?.id])

  async function submit(e: FormEvent) {
    e.preventDefault()
    const amount = parseMoney(form.amount)
    const dueDate = fromDateInput(form.dueDate)
    const next: Errors = { name: requireText(form.name, 'Name', 60), amount: requirePositiveMoney(amount), dueDate: requireBusinessDate(dueDate, 'Due date') }
    setErrors(next)
    if (hasErrors(next)) return
    const input = {
      name: form.name.trim(),
      kind: form.kind,
      amount: amount!,
      dueDate: dueDate!,
      frequency: form.frequency,
      accountId: form.accountId || undefined,
      categoryId: form.categoryId || undefined,
    }
    await run(async () => {
      if (existing) await updateBill(uid, existing.id, input)
      else await createBill(uid, input)
    }, onClose)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={existing ? 'Edit bill' : 'New bill'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="bill-form" loading={busy}>
            Save bill
          </Button>
        </>
      }
    >
      <form id="bill-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <TextField label="Name" placeholder="Meralco" maxLength={60} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} />
        <SelectField label="Type" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as BillKind })} options={BILL_KINDS} />
        <MoneyField label="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} error={errors.amount} />
        <TextField label={existing ? 'Next due date' : 'First due date'} type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} error={errors.dueDate} />
        <SelectField label="Repeats" value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value as BillFrequency })} options={BILL_FREQUENCIES} />
        <SelectField label="Usually paid from (optional)" value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })} options={accounts.filter((a) => a.status === 'active').map((a) => ({ value: a.id, label: a.name }))} placeholder="—" />
        <SelectField className="sm:col-span-2" label="Expense category (optional)" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} options={categories.filter((c) => c.type === 'expense').map((c) => ({ value: c.id, label: c.name }))} placeholder="—" />
        <div className="sm:col-span-2">
          <FormError message={error} />
        </div>
      </form>
    </Modal>
  )
}

function PayBillForm({ bill, onClose }: { bill: Bill | null; onClose: () => void }) {
  const { uid, accounts, categories } = useFinance()
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState('')
  const [accountId, setAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const { busy, error, setError, run } = useAsyncAction()

  useEffect(() => {
    if (!bill) return
    setAmount(toMoneyInput(bill.amount))
    setDate(toDateInput(new Date()))
    setAccountId(bill.accountId ?? '')
    setCategoryId(bill.categoryId ?? '')
    setErrors({})
    setError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bill?.id])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!bill) return
    const value = parseMoney(amount)
    const d = fromDateInput(date)
    const next: Errors = {
      amount: requirePositiveMoney(value),
      date: requireBusinessDate(d),
      categoryId: accountId && !categoryId ? 'Choose a category to record the expense.' : undefined,
    }
    setErrors(next)
    if (hasErrors(next)) return
    await run(() => markBillPaid(uid, bill, { amount: value!, date: d!, accountId: accountId || undefined, categoryId: accountId ? categoryId : undefined }), onClose)
  }

  return (
    <Modal
      open={!!bill}
      onClose={onClose}
      title={`Pay ${bill?.name ?? ''}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="pay-bill-form" loading={busy}>
            Mark as paid
          </Button>
        </>
      }
    >
      <form id="pay-bill-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <MoneyField label="Amount paid" value={amount} onChange={(e) => setAmount(e.target.value)} error={errors.amount} />
        <TextField label="Paid on" type="date" value={date} onChange={(e) => setDate(e.target.value)} error={errors.date} />
        <SelectField label="Paid from (records an expense)" value={accountId} onChange={(e) => setAccountId(e.target.value)} options={accounts.filter((a) => a.status === 'active').map((a) => ({ value: a.id, label: a.name }))} placeholder="Don't record a transaction" />
        <SelectField label="Category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} options={categories.filter((c) => c.type === 'expense').map((c) => ({ value: c.id, label: c.name }))} placeholder="—" disabled={!accountId} error={errors.categoryId} />
        {bill && bill.frequency !== 'once' && <p className="text-xs text-ink-faint sm:col-span-2">The next due date will move forward automatically.</p>}
        <div className="sm:col-span-2">
          <FormError message={error} />
        </div>
      </form>
    </Modal>
  )
}
