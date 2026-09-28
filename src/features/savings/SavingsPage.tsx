import { useEffect, useState, type FormEvent } from 'react'
import { History, Minus, Pencil, PiggyBank, Plus, Trash2 } from 'lucide-react'
import { onSnapshot, query, where } from 'firebase/firestore'
import { Button, Card, ConfirmDialog, EmptyState, FormError, IconButton, Modal, MoneyField, PageHeader, ProgressBar, Segmented, TextField } from '../../components/ui'
import { useFinance } from '../../data/FinanceDataProvider'
import { formatDate, fromDateInput, toDateInput } from '../../lib/dates'
import { formatMoney, parseMoney, sum, toMoneyInput } from '../../lib/money'
import { fromFirestore, userCol } from '../../lib/firestore'
import { useAsyncAction } from '../../lib/useAsyncAction'
import { hasErrors, optionalText, requireBusinessDate, requirePositiveMoney, requireText, type Errors } from '../../lib/validation'
import { savingsProgress } from './savingsCalc'
import { addContribution, createSavingsGoal, deleteSavingsGoal, updateSavingsGoal } from './savingsService'
import { SAVINGS_PRESETS, type SavingsContribution, type SavingsGoal } from './types'

export function SavingsPage() {
  const { uid, savingsGoals } = useFinance()
  const [editing, setEditing] = useState<SavingsGoal | null | undefined>(undefined)
  const [contributing, setContributing] = useState<SavingsGoal | null>(null)
  const [history, setHistory] = useState<SavingsGoal | null>(null)
  const [deleting, setDeleting] = useState<SavingsGoal | null>(null)

  const saved = sum(savingsGoals.map((g) => g.currentAmount))
  const target = sum(savingsGoals.map((g) => g.targetAmount))

  return (
    <>
      <PageHeader
        title="Savings"
        description="Set aside money for what matters. Goal amounts are earmarked within your accounts."
        actions={
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setEditing(null)}>
            New goal
          </Button>
        }
      />

      {savingsGoals.length > 0 && (
        <Card className="mb-6">
          <p className="text-xs text-ink-faint">Total saved</p>
          <p className="tabular mt-1 text-2xl font-semibold">
            {formatMoney(saved)} <span className="text-base font-normal text-ink-faint">of {formatMoney(target)}</span>
          </p>
          <div className="mt-4">
            <ProgressBar label="Total savings progress" value={target ? (saved / target) * 100 : 0} />
          </div>
        </Card>
      )}

      {savingsGoals.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {savingsGoals.map((g) => {
            const p = savingsProgress(g)
            return (
              <Card key={g.id}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{g.name}</p>
                    <p className="text-xs text-ink-faint">{g.targetDate ? `Target ${formatDate(g.targetDate)}` : 'No target date'}</p>
                  </div>
                  <div className="flex gap-1">
                    <IconButton label={`History for ${g.name}`} onClick={() => setHistory(g)}>
                      <History size={14} />
                    </IconButton>
                    <IconButton label={`Edit ${g.name}`} onClick={() => setEditing(g)}>
                      <Pencil size={14} />
                    </IconButton>
                    <IconButton label={`Delete ${g.name}`} onClick={() => setDeleting(g)}>
                      <Trash2 size={14} />
                    </IconButton>
                  </div>
                </div>
                <p className="tabular mt-4 text-2xl font-semibold">{formatMoney(g.currentAmount)}</p>
                <p className="text-xs text-ink-faint">of {formatMoney(g.targetAmount)}</p>
                <div className="mt-3">
                  <ProgressBar label={`${g.name} progress`} value={p.percentage} tone={p.percentage >= 100 ? 'positive' : 'accent'} />
                </div>
                <dl className="tabular mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <dt className="text-ink-faint">Progress</dt>
                    <dd>{p.percentage}%</dd>
                  </div>
                  <div>
                    <dt className="text-ink-faint">Remaining</dt>
                    <dd>{formatMoney(p.remaining)}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-faint">Needed / month</dt>
                    <dd>{p.requiredMonthly == null ? '—' : formatMoney(p.requiredMonthly)}</dd>
                  </div>
                </dl>
                <Button className="mt-4 w-full" icon={<Plus size={14} />} onClick={() => setContributing(g)}>
                  Add / withdraw
                </Button>
              </Card>
            )
          })}
        </div>
      ) : (
        <EmptyState
          icon={<PiggyBank size={28} />}
          title="No savings goals yet"
          description="Emergency fund, travel, a motorcycle, a laptop, a house, education…"
          action={<Button variant="primary" onClick={() => setEditing(null)}>Create a goal</Button>}
        />
      )}
      <p className="mt-6 text-xs text-ink-faint">"Needed / month" is a simple calculation (remaining ÷ months left), not a recommendation.</p>

      <GoalForm open={editing !== undefined} existing={editing ?? undefined} onClose={() => setEditing(undefined)} />
      <ContributionForm goal={contributing} onClose={() => setContributing(null)} />
      <ContributionHistory goal={history} onClose={() => setHistory(null)} />
      <ConfirmDialog
        open={!!deleting}
        title="Delete savings goal?"
        message={`"${deleting?.name}" and its contribution history will be permanently deleted.`}
        onConfirm={() => deleteSavingsGoal(uid, deleting!)}
        onClose={() => setDeleting(null)}
      />
    </>
  )
}

function GoalForm({ open, onClose, existing }: { open: boolean; onClose: () => void; existing?: SavingsGoal }) {
  const { uid } = useFinance()
  const [form, setForm] = useState({ name: '', target: '', starting: '', targetDate: '' })
  const [errors, setErrors] = useState<Errors>({})
  const { busy, error, setError, run } = useAsyncAction()

  useEffect(() => {
    if (!open) return
    setForm({
      name: existing?.name ?? '',
      target: existing ? toMoneyInput(existing.targetAmount) : '',
      starting: '',
      targetDate: toDateInput(existing?.targetDate ?? null),
    })
    setErrors({})
    setError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existing?.id])

  async function submit(e: FormEvent) {
    e.preventDefault()
    const targetAmount = parseMoney(form.target)
    const starting = form.starting.trim() ? parseMoney(form.starting) : 0
    const targetDate = form.targetDate ? fromDateInput(form.targetDate) : null
    const next: Errors = {
      name: requireText(form.name, 'Name', 60),
      target: requirePositiveMoney(targetAmount, 'Target'),
      starting: starting === null ? 'Enter a valid amount.' : undefined,
      targetDate: form.targetDate && !targetDate ? 'Enter a valid date.' : undefined,
    }
    setErrors(next)
    if (hasErrors(next)) return
    const input = { name: form.name.trim(), targetAmount: targetAmount!, targetDate }
    await run(async () => {
      if (existing) await updateSavingsGoal(uid, existing.id, input)
      else await createSavingsGoal(uid, input, starting ?? 0)
    }, onClose)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={existing ? 'Edit savings goal' : 'New savings goal'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="goal-form" loading={busy}>
            Save goal
          </Button>
        </>
      }
    >
      <form id="goal-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <TextField label="Goal name" list="savings-presets" maxLength={60} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} />
        <datalist id="savings-presets">
          {SAVINGS_PRESETS.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
        <div className="grid gap-4 sm:grid-cols-2">
          <MoneyField label="Target amount" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} error={errors.target} />
          <TextField label="Target date (optional)" type="date" value={form.targetDate} onChange={(e) => setForm({ ...form, targetDate: e.target.value })} error={errors.targetDate} />
          {!existing && (
            <MoneyField label="Already saved (optional)" value={form.starting} onChange={(e) => setForm({ ...form, starting: e.target.value })} error={errors.starting} />
          )}
        </div>
        {existing && <p className="text-xs text-ink-faint">To change the saved amount, add a contribution or withdrawal so the history stays accurate.</p>}
        <FormError message={error} />
      </form>
    </Modal>
  )
}

function ContributionForm({ goal, onClose }: { goal: SavingsGoal | null; onClose: () => void }) {
  const { uid } = useFinance()
  const [mode, setMode] = useState<'add' | 'withdraw'>('add')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(toDateInput(new Date()))
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const { busy, error, setError, run } = useAsyncAction()

  useEffect(() => {
    if (goal) {
      setMode('add')
      setAmount('')
      setDate(toDateInput(new Date()))
      setNote('')
      setErrors({})
      setError(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goal?.id])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!goal) return
    const value = parseMoney(amount)
    const d = fromDateInput(date)
    const next: Errors = {
      amount: requirePositiveMoney(value) ?? (mode === 'withdraw' && value! > goal.currentAmount ? 'Cannot withdraw more than is saved.' : undefined),
      date: requireBusinessDate(d),
      note: optionalText(note, 'Note', 200),
    }
    setErrors(next)
    if (hasErrors(next)) return
    await run(() => addContribution(uid, goal, mode === 'add' ? value! : -value!, d!, note), onClose)
  }

  return (
    <Modal
      open={!!goal}
      onClose={onClose}
      title={goal ? `${goal.name}` : ''}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="contribution-form" loading={busy} icon={mode === 'add' ? <Plus size={14} /> : <Minus size={14} />}>
            {mode === 'add' ? 'Add to goal' : 'Withdraw'}
          </Button>
        </>
      }
    >
      <form id="contribution-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Segmented label="Contribution type" value={mode} onChange={setMode} options={[{ value: 'add', label: 'Add' }, { value: 'withdraw', label: 'Withdraw' }]} />
        <div className="grid gap-4 sm:grid-cols-2">
          <MoneyField label="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} error={errors.amount} />
          <TextField label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} error={errors.date} />
        </div>
        <TextField label="Note (optional)" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} error={errors.note} />
        <FormError message={error} />
      </form>
    </Modal>
  )
}

function ContributionHistory({ goal, onClose }: { goal: SavingsGoal | null; onClose: () => void }) {
  const { uid } = useFinance()
  const [items, setItems] = useState<SavingsContribution[]>([])

  useEffect(() => {
    if (!goal) return
    return onSnapshot(
      query(userCol(uid, 'savingsContributions'), where('goalId', '==', goal.id)),
      (snap) =>
        setItems(
          snap.docs
            .map((d) => fromFirestore<SavingsContribution>(d.id, d.data({ serverTimestamps: 'estimate' })))
            .sort((a, b) => b.date.getTime() - a.date.getTime()),
        ),
      () => setItems([]),
    )
  }, [uid, goal])

  return (
    <Modal open={!!goal} onClose={onClose} title={`History · ${goal?.name ?? ''}`}>
      {items.length ? (
        <ul className="divide-y divide-line">
          {items.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <div className="min-w-0">
                <p>{formatDate(c.date)}</p>
                {c.note && <p className="truncate text-xs text-ink-faint">{c.note}</p>}
              </div>
              <span className={`tabular ${c.amount > 0 ? 'text-positive' : 'text-negative'}`}>
                {c.amount > 0 ? '+' : '-'}
                {formatMoney(Math.abs(c.amount))}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-faint">No contributions yet.</p>
      )}
    </Modal>
  )
}
