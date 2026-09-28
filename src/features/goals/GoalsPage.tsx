import { useEffect, useState, type FormEvent } from 'react'
import { Flag, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button, Card, ConfirmDialog, EmptyState, FormError, IconButton, Modal, MoneyField, PageHeader, ProgressBar, SelectField, TextAreaField, TextField } from '../../components/ui'
import { useFinance } from '../../data/FinanceDataProvider'
import { formatDate, fromDateInput, toDateInput } from '../../lib/dates'
import { formatMoney, parseMoney, toMoneyInput } from '../../lib/money'
import { useAsyncAction } from '../../lib/useAsyncAction'
import { hasErrors, optionalText, requireMoney, requireText, type Errors } from '../../lib/validation'
import { DebtCoachCard } from '../coach/DebtCoachCard'
import { DebtPlannerCard } from './DebtPlannerCard'
import { goalProgress } from './goalCalc'
import { createGoal, deleteGoal, updateGoal } from './goalService'
import { GOAL_KINDS, type FinancialGoal, type FinancialGoalKind } from './types'

export function GoalsPage() {
  const { uid, financialGoals, netWorth, savingsGoals } = useFinance()
  const [editing, setEditing] = useState<FinancialGoal | null | undefined>(undefined)
  const [deleting, setDeleting] = useState<FinancialGoal | null>(null)

  return (
    <>
      <PageHeader
        title="Goals"
        description="Big-picture financial milestones, tracked from your data."
        actions={
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setEditing(null)}>
            New goal
          </Button>
        }
      />
      <DebtPlannerCard />
      <DebtCoachCard />

      {financialGoals.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {financialGoals.map((g) => {
            const p = goalProgress(g, netWorth, savingsGoals)
            return (
              <Card key={g.id}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{g.name}</p>
                    <p className="text-xs text-ink-faint">
                      {GOAL_KINDS.find((k) => k.value === g.kind)?.label}
                      {g.targetDate && ` · by ${formatDate(g.targetDate)}`}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <IconButton label={`Edit ${g.name}`} onClick={() => setEditing(g)}>
                      <Pencil size={14} />
                    </IconButton>
                    <IconButton label={`Delete ${g.name}`} onClick={() => setDeleting(g)}>
                      <Trash2 size={14} />
                    </IconButton>
                  </div>
                </div>
                <div className="mt-4 flex items-end justify-between gap-2">
                  <div>
                    <p className="text-xs text-ink-faint">{p.label}</p>
                    <p className="tabular text-xl font-semibold">{formatMoney(p.current)}</p>
                  </div>
                  <p className="tabular text-sm text-ink-muted">{p.percentage}%</p>
                </div>
                <div className="mt-3">
                  <ProgressBar label={`${g.name} progress`} value={p.percentage} tone={p.percentage >= 100 ? 'positive' : 'accent'} />
                </div>
                <p className="tabular mt-2 text-xs text-ink-faint">
                  {g.kind === 'debt_free' ? `Started at ${formatMoney(p.target)} owed` : `Target ${formatMoney(p.target)}`}
                </p>
                {g.notes && <p className="mt-3 text-sm whitespace-pre-line text-ink-muted">{g.notes}</p>}
              </Card>
            )
          })}
        </div>
      ) : (
        <EmptyState icon={<Flag size={28} />} title="No goals yet" description="E.g. reach ₱1M net worth, become debt-free, or save ₱300,000 in total." />
      )}

      <GoalForm open={editing !== undefined} existing={editing ?? undefined} onClose={() => setEditing(undefined)} />
      <ConfirmDialog open={!!deleting} title="Delete goal?" message={`"${deleting?.name}" will be deleted.`} onConfirm={() => deleteGoal(uid, deleting!)} onClose={() => setDeleting(null)} />
    </>
  )
}

function GoalForm({ open, onClose, existing }: { open: boolean; onClose: () => void; existing?: FinancialGoal }) {
  const { uid, netWorth } = useFinance()
  const [form, setForm] = useState({ name: '', kind: 'net_worth' as FinancialGoalKind, target: '', current: '', targetDate: '', notes: '' })
  const [errors, setErrors] = useState<Errors>({})
  const { busy, error, setError, run } = useAsyncAction()

  useEffect(() => {
    if (!open) return
    setForm({
      name: existing?.name ?? '',
      kind: existing?.kind ?? 'net_worth',
      target: existing ? toMoneyInput(existing.targetAmount) : '',
      current: existing?.currentAmount != null ? toMoneyInput(existing.currentAmount) : '',
      targetDate: toDateInput(existing?.targetDate ?? null),
      notes: existing?.notes ?? '',
    })
    setErrors({})
    setError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existing?.id])

  const kind = GOAL_KINDS.find((k) => k.value === form.kind)!

  async function submit(e: FormEvent) {
    e.preventDefault()
    const target = form.kind === 'debt_free' && !form.target.trim() ? netWorth.liabilities : parseMoney(form.target)
    const current = form.kind === 'custom' ? parseMoney(form.current || '0') : undefined
    const targetDate = form.targetDate ? fromDateInput(form.targetDate) : null
    const errs: Errors = {
      name: requireText(form.name, 'Name', 60),
      target: requireMoney(target, 'Target'),
      current: current === null ? 'Enter a valid amount.' : undefined,
      targetDate: form.targetDate && !targetDate ? 'Enter a valid date.' : undefined,
      notes: optionalText(form.notes, 'Notes', 500),
    }
    setErrors(errs)
    if (hasErrors(errs)) return
    const input = {
      name: form.name.trim(),
      kind: form.kind,
      targetAmount: target!,
      currentAmount: current ?? undefined,
      targetDate,
      notes: form.notes.trim() || undefined,
    }
    await run(async () => {
      if (existing) await updateGoal(uid, existing.id, input)
      else await createGoal(uid, input)
    }, onClose)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={existing ? 'Edit goal' : 'New goal'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="fgoal-form" loading={busy}>
            Save goal
          </Button>
        </>
      }
    >
      <form id="fgoal-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <TextField className="sm:col-span-2" label="Goal name" maxLength={60} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} />
        <SelectField className="sm:col-span-2" label="Goal type" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as FinancialGoalKind })} options={GOAL_KINDS} hint={kind.hint} />
        <MoneyField
          label={form.kind === 'debt_free' ? 'Starting liabilities' : 'Target amount'}
          value={form.target}
          onChange={(e) => setForm({ ...form, target: e.target.value })}
          error={errors.target}
          hint={form.kind === 'debt_free' ? `Leave blank to use today's ${formatMoney(netWorth.liabilities)}.` : undefined}
        />
        <TextField label="Target date (optional)" type="date" value={form.targetDate} onChange={(e) => setForm({ ...form, targetDate: e.target.value })} error={errors.targetDate} />
        {form.kind === 'custom' && <MoneyField label="Current progress" value={form.current} onChange={(e) => setForm({ ...form, current: e.target.value })} error={errors.current} />}
        <TextAreaField className="sm:col-span-2" label="Notes (optional)" maxLength={500} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} error={errors.notes} />
        <div className="sm:col-span-2">
          <FormError message={error} />
        </div>
      </form>
    </Modal>
  )
}
