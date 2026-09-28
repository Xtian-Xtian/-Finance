import { useEffect, useState, type FormEvent } from 'react'
import { HandCoins, History, Pencil, Plus, Trash2 } from 'lucide-react'
import { onSnapshot, query, where } from 'firebase/firestore'
import { Button, Card, ConfirmDialog, EmptyState, FormError, IconButton, Modal, MoneyField, Notice, PageHeader, ProgressBar, Segmented, SelectField, TextField } from '../../components/ui'
import { useFinance } from '../../data/FinanceDataProvider'
import { formatDate, fromDateInput, toDateInput } from '../../lib/dates'
import { formatMoney, parseMoney, sum, toMoneyInput } from '../../lib/money'
import { fromFirestore, userCol } from '../../lib/firestore'
import { useAsyncAction } from '../../lib/useAsyncAction'
import { hasErrors, optionalText, requireBusinessDate, requireMoney, requirePositiveMoney, requireText, type Errors } from '../../lib/validation'
import { estimatePayoff, paidOffPercent } from './debtCalc'
import { createDebt, deleteDebt, recordDebtPayment, updateDebt } from './debtService'
import { formatRate, PAYMENT_FREQUENCIES, type Debt, type DebtPayment, type PaymentFrequency } from './types'

export function DebtsPage() {
  const { uid, debts } = useFinance()
  const [editing, setEditing] = useState<Debt | null | undefined>(undefined)
  const [paying, setPaying] = useState<Debt | null>(null)
  const [history, setHistory] = useState<Debt | null>(null)
  const [deleting, setDeleting] = useState<Debt | null>(null)

  return (
    <>
      <PageHeader
        title="Debts"
        description="Loans and other money you owe."
        actions={
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setEditing(null)}>
            Add debt
          </Button>
        }
      />

      {debts.length > 0 && (
        <Card className="mb-6">
          <p className="text-xs text-ink-faint">Total outstanding</p>
          <p className="tabular mt-1 text-2xl font-semibold text-negative">{formatMoney(sum(debts.map((d) => d.outstandingBalance)))}</p>
        </Card>
      )}

      {debts.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {debts.map((d) => {
            const estimate = estimatePayoff(d)
            const paid = paidOffPercent(d)
            return (
              <Card key={d.id}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{d.name}</p>
                    <p className="text-xs text-ink-faint">
                      {[d.lender, `${formatRate(d.interestRate)} / yr`, `${formatMoney(d.paymentAmount)} ${d.paymentFrequency}`].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <IconButton label={`Payment history for ${d.name}`} onClick={() => setHistory(d)}>
                      <History size={14} />
                    </IconButton>
                    <IconButton label={`Edit ${d.name}`} onClick={() => setEditing(d)}>
                      <Pencil size={14} />
                    </IconButton>
                    <IconButton label={`Delete ${d.name}`} onClick={() => setDeleting(d)}>
                      <Trash2 size={14} />
                    </IconButton>
                  </div>
                </div>
                <div className="mt-4 flex items-end justify-between">
                  <div>
                    <p className="text-xs text-ink-faint">Outstanding</p>
                    <p className="tabular text-2xl font-semibold">{formatMoney(d.outstandingBalance)}</p>
                  </div>
                  <p className="tabular text-xs text-ink-faint">of {formatMoney(d.principal)} borrowed</p>
                </div>
                <div className="mt-3">
                  <ProgressBar label={`${d.name} paid off`} value={paid} tone="positive" />
                </div>
                <dl className="tabular mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <dt className="text-ink-faint">Paid off</dt>
                    <dd>{paid}%</dd>
                  </div>
                  <div>
                    <dt className="text-ink-faint">Next payment</dt>
                    <dd>{formatDate(d.nextPaymentDate)}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-faint">Est. payments left*</dt>
                    <dd>{estimate.payments == null ? 'Not covered' : estimate.payments}</dd>
                  </div>
                </dl>
                <Button className="mt-4 w-full" icon={<HandCoins size={14} />} onClick={() => setPaying(d)} disabled={d.outstandingBalance === 0}>
                  Record payment
                </Button>
              </Card>
            )
          })}
        </div>
      ) : (
        <EmptyState icon={<HandCoins size={28} />} title="No debts tracked" description="Add loans (personal, car, housing, salary loans…) to track what's left to pay." />
      )}
      <p className="mt-6 text-xs text-ink-faint">
        *Estimates assume a fixed interest rate and the scheduled payment amount. They are calculations only — not guarantees or financial advice. Your
        lender's statement is authoritative.
      </p>

      <DebtForm open={editing !== undefined} existing={editing ?? undefined} onClose={() => setEditing(undefined)} />
      <PaymentForm debt={paying} onClose={() => setPaying(null)} />
      <PaymentHistory debt={history} onClose={() => setHistory(null)} />
      <ConfirmDialog open={!!deleting} title="Delete debt?" message={`"${deleting?.name}" and its payment history will be deleted. Expense transactions already recorded are kept.`} onConfirm={() => deleteDebt(uid, deleting!)} onClose={() => setDeleting(null)} />
    </>
  )
}

function DebtForm({ open, onClose, existing }: { open: boolean; onClose: () => void; existing?: Debt }) {
  const { uid } = useFinance()
  const empty = { name: '', lender: '', principal: '', outstanding: '', rate: '', payment: '', frequency: 'monthly' as PaymentFrequency, nextPaymentDate: '' }
  const [form, setForm] = useState(empty)
  const [errors, setErrors] = useState<Errors>({})
  const { busy, error, setError, run } = useAsyncAction()

  useEffect(() => {
    if (!open) return
    setForm(
      existing
        ? {
            name: existing.name,
            lender: existing.lender ?? '',
            principal: toMoneyInput(existing.principal),
            outstanding: toMoneyInput(existing.outstandingBalance),
            rate: (existing.interestRate / 100).toString(),
            payment: toMoneyInput(existing.paymentAmount),
            frequency: existing.paymentFrequency,
            nextPaymentDate: toDateInput(existing.nextPaymentDate ?? null),
          }
        : empty,
    )
    setErrors({})
    setError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existing?.id])

  async function submit(e: FormEvent) {
    e.preventDefault()
    const principal = parseMoney(form.principal)
    const outstanding = existing ? existing.outstandingBalance : parseMoney(form.outstanding || form.principal)
    const payment = parseMoney(form.payment || '0')
    const rateMatch = /^\d{1,3}(\.\d{1,2})?$/.test(form.rate.trim() || '0')
    const rateBp = rateMatch ? Math.round(Number(form.rate.trim() || '0') * 100) : null
    const next = form.nextPaymentDate ? fromDateInput(form.nextPaymentDate) : null
    const errs: Errors = {
      name: requireText(form.name, 'Name', 60),
      lender: optionalText(form.lender, 'Lender', 60),
      principal: requirePositiveMoney(principal, 'Loan amount'),
      outstanding: requireMoney(outstanding, 'Outstanding balance') ?? (outstanding! < 0 ? 'Cannot be negative.' : undefined),
      rate: rateBp === null || rateBp > 10000 ? 'Enter an annual rate between 0 and 100.' : undefined,
      payment: requireMoney(payment, 'Payment amount'),
      nextPaymentDate: form.nextPaymentDate && !next ? 'Enter a valid date.' : undefined,
    }
    setErrors(errs)
    if (hasErrors(errs)) return
    const input = {
      name: form.name.trim(),
      lender: form.lender.trim() || undefined,
      principal: principal!,
      interestRate: rateBp!,
      paymentAmount: payment!,
      paymentFrequency: form.frequency,
      nextPaymentDate: next,
    }
    await run(async () => {
      if (existing) await updateDebt(uid, existing.id, input)
      else await createDebt(uid, input, outstanding!)
    }, onClose)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={existing ? 'Edit debt' : 'New debt'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="debt-form" loading={busy}>
            Save debt
          </Button>
        </>
      }
    >
      <form id="debt-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <TextField label="Name" placeholder="Car loan" maxLength={60} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} />
        <TextField label="Lender (optional)" maxLength={60} value={form.lender} onChange={(e) => setForm({ ...form, lender: e.target.value })} error={errors.lender} />
        <MoneyField label="Loan amount" value={form.principal} onChange={(e) => setForm({ ...form, principal: e.target.value })} error={errors.principal} />
        {existing ? (
          <MoneyField label="Outstanding balance" value={form.outstanding} disabled hint="Change via payments or adjustments." />
        ) : (
          <MoneyField label="Outstanding balance" value={form.outstanding} onChange={(e) => setForm({ ...form, outstanding: e.target.value })} error={errors.outstanding} hint="Defaults to the loan amount." />
        )}
        <TextField label="Annual interest rate (%)" inputMode="decimal" placeholder="12.5" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} error={errors.rate} />
        <MoneyField label="Scheduled payment" value={form.payment} onChange={(e) => setForm({ ...form, payment: e.target.value })} error={errors.payment} />
        <SelectField label="Payment frequency" value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value as PaymentFrequency })} options={PAYMENT_FREQUENCIES} />
        <TextField label="Next payment date" type="date" value={form.nextPaymentDate} onChange={(e) => setForm({ ...form, nextPaymentDate: e.target.value })} error={errors.nextPaymentDate} />
        <div className="sm:col-span-2">
          <FormError message={error} />
        </div>
      </form>
    </Modal>
  )
}

function PaymentForm({ debt, onClose }: { debt: Debt | null; onClose: () => void }) {
  const { uid, accounts, categories } = useFinance()
  const [kind, setKind] = useState<'payment' | 'charge' | 'correction'>('payment')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState('')
  const [note, setNote] = useState('')
  const [accountId, setAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const { busy, error, setError, run } = useAsyncAction()

  useEffect(() => {
    if (!debt) return
    setKind('payment')
    setAmount(debt.paymentAmount ? toMoneyInput(Math.min(debt.paymentAmount, debt.outstandingBalance)) : '')
    setDate(toDateInput(new Date()))
    setNote('')
    setAccountId('')
    setCategoryId(categories.find((c) => c.type === 'expense' && c.name === 'Loan Payments')?.id ?? '')
    setErrors({})
    setError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debt?.id])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!debt) return
    const value = parseMoney(amount)
    const d = fromDateInput(date)
    const errs: Errors = {
      amount: requirePositiveMoney(value) ?? (kind !== 'charge' && value! > debt.outstandingBalance ? 'Exceeds the outstanding balance.' : undefined),
      date: requireBusinessDate(d),
      note: optionalText(note, 'Note', 200),
      categoryId: kind === 'payment' && accountId && !categoryId ? 'Choose a category.' : undefined,
    }
    setErrors(errs)
    if (hasErrors(errs)) return
    await run(
      () =>
        recordDebtPayment(uid, debt, {
          kind: kind === 'payment' ? 'payment' : 'adjustment',
          amount: kind === 'charge' ? -value! : value!,
          date: d!,
          note,
          accountId: kind === 'payment' ? accountId || undefined : undefined,
          categoryId: kind === 'payment' && accountId ? categoryId : undefined,
        }),
      onClose,
    )
  }

  return (
    <Modal
      open={!!debt}
      onClose={onClose}
      title={debt ? `Update ${debt.name}` : ''}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="debt-payment-form" loading={busy}>
            Save
          </Button>
        </>
      }
    >
      <form id="debt-payment-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Segmented
          label="Entry type"
          value={kind}
          onChange={setKind}
          options={[
            { value: 'payment', label: 'Payment' },
            { value: 'charge', label: 'Interest / fees' },
            { value: 'correction', label: 'Reduce balance' },
          ]}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <MoneyField label="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} error={errors.amount} />
          <TextField label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} error={errors.date} />
          {kind === 'payment' && (
            <>
              <SelectField label="Paid from (records an expense)" value={accountId} onChange={(e) => setAccountId(e.target.value)} options={accounts.filter((a) => a.status === 'active').map((a) => ({ value: a.id, label: a.name }))} placeholder="Don't record a transaction" />
              <SelectField label="Category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} options={categories.filter((c) => c.type === 'expense').map((c) => ({ value: c.id, label: c.name }))} placeholder="—" disabled={!accountId} error={errors.categoryId} />
            </>
          )}
        </div>
        <TextField label="Note (optional)" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} error={errors.note} />
        {kind === 'payment' && <Notice>The full payment reduces the outstanding balance. If part of it was interest, add the interest first under "Interest / fees".</Notice>}
        <FormError message={error} />
      </form>
    </Modal>
  )
}

function PaymentHistory({ debt, onClose }: { debt: Debt | null; onClose: () => void }) {
  const { uid } = useFinance()
  const [items, setItems] = useState<DebtPayment[]>([])

  useEffect(() => {
    if (!debt) return
    return onSnapshot(
      query(userCol(uid, 'debtPayments'), where('debtId', '==', debt.id)),
      (snap) =>
        setItems(
          snap.docs
            .map((d) => fromFirestore<DebtPayment>(d.id, d.data({ serverTimestamps: 'estimate' })))
            .sort((a, b) => b.date.getTime() - a.date.getTime()),
        ),
      () => setItems([]),
    )
  }, [uid, debt])

  return (
    <Modal open={!!debt} onClose={onClose} title={`Payment history · ${debt?.name ?? ''}`}>
      {items.length ? (
        <ul className="divide-y divide-line">
          {items.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <div className="min-w-0">
                <p>
                  {formatDate(p.date)} · {p.kind === 'payment' ? 'Payment' : p.principalDelta < 0 ? 'Interest / fees' : 'Balance reduction'}
                </p>
                {p.note && <p className="truncate text-xs text-ink-faint">{p.note}</p>}
              </div>
              <span className={`tabular ${p.principalDelta > 0 ? 'text-positive' : 'text-negative'}`}>
                {p.principalDelta > 0 ? '-' : '+'}
                {formatMoney(Math.abs(p.principalDelta))}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-faint">No payments recorded yet.</p>
      )}
    </Modal>
  )
}
