import { useEffect, useState, type FormEvent } from 'react'
import { Button, FormError, Modal, MoneyField, SelectField, TextField } from '../../components/ui'
import { useFinance } from '../../data/FinanceDataProvider'
import { parseMoney, toMoneyInput } from '../../lib/money'
import { useAsyncAction } from '../../lib/useAsyncAction'
import { hasErrors, optionalText, requireMoney, requireText, type Errors } from '../../lib/validation'
import { createAccount, updateAccount, type AccountInput } from './accountService'
import { ACCOUNT_TYPES, isLiability, type Account, type AccountType } from './types'

interface FormState {
  name: string
  type: AccountType
  institution: string
  openingBalance: string
  status: 'active' | 'archived'
  lastFour: string
  creditLimit: string
  statementDay: string
  dueDay: string
}

function toForm(a?: Account): FormState {
  if (!a) {
    return { name: '', type: 'bank', institution: '', openingBalance: '', status: 'active', lastFour: '', creditLimit: '', statementDay: '', dueDay: '' }
  }
  return {
    name: a.name,
    type: a.type,
    institution: a.institution ?? '',
    // Liabilities are stored negative; the form asks for the positive amount owed.
    openingBalance: toMoneyInput(isLiability(a.type) ? -a.openingBalance : a.openingBalance),
    status: a.status,
    lastFour: a.lastFour ?? '',
    creditLimit: a.creditLimit != null ? toMoneyInput(a.creditLimit) : '',
    statementDay: a.statementDay ? String(a.statementDay) : '',
    dueDay: a.dueDay ? String(a.dueDay) : '',
  }
}

function parseDay(v: string): number | undefined | null {
  if (!v.trim()) return undefined
  const n = Number(v)
  return Number.isInteger(n) && n >= 1 && n <= 31 ? n : null
}

export function AccountForm({ open, onClose, existing }: { open: boolean; onClose: () => void; existing?: Account }) {
  const { uid } = useFinance()
  const [form, setForm] = useState<FormState>(() => toForm(existing))
  const [errors, setErrors] = useState<Errors>({})
  const { busy, error, setError, run } = useAsyncAction()

  useEffect(() => {
    if (open) {
      setForm(toForm(existing))
      setErrors({})
      setError(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existing?.id])

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }))
  const liability = isLiability(form.type)
  const isCard = form.type === 'credit_card'
  const showLastFour = form.type !== 'cash'
  const isLoan = form.type === 'loan'

  async function submit(e: FormEvent) {
    e.preventDefault()
    const opening = parseMoney(form.openingBalance || '0', { allowNegative: !liability })
    const creditLimit = form.creditLimit.trim() ? parseMoney(form.creditLimit) : undefined
    const statementDay = parseDay(form.statementDay)
    const dueDay = parseDay(form.dueDay)
    const next: Errors = {
      name: requireText(form.name, 'Name', 60),
      institution: optionalText(form.institution, 'Institution', 60),
      openingBalance: requireMoney(opening, liability ? 'Amount owed' : 'Opening balance'),
      lastFour: showLastFour && form.lastFour && !/^\d{4}$/.test(form.lastFour) ? 'Enter exactly the last 4 digits.' : undefined,
      creditLimit: creditLimit === null ? 'Enter a valid credit limit.' : undefined,
      statementDay: statementDay === null ? 'Day must be 1–31.' : undefined,
      dueDay: dueDay === null ? 'Day must be 1–31.' : undefined,
    }
    setErrors(next)
    if (hasErrors(next)) return

    const input: AccountInput = {
      name: form.name.trim(),
      type: form.type,
      institution: form.institution.trim() || undefined,
      currency: 'PHP',
      openingBalance: liability ? -(opening ?? 0) : (opening ?? 0),
      status: form.status,
      lastFour: showLastFour && form.lastFour ? form.lastFour : undefined,
      creditLimit: isCard || isLoan ? (creditLimit ?? undefined) : undefined,
      statementDay: isCard ? (statementDay ?? undefined) : undefined,
      dueDay: isCard ? (dueDay ?? undefined) : undefined,
    }
    await run(async () => {
      if (existing) await updateAccount(uid, existing.id, input)
      else await createAccount(uid, input)
    }, onClose)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={existing ? 'Edit account' : 'New account'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="account-form" loading={busy}>
            {existing ? 'Save changes' : 'Add account'}
          </Button>
        </>
      }
    >
      <form id="account-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Account name" placeholder="BPI Savings" maxLength={60} value={form.name} onChange={(e) => set('name', e.target.value)} error={errors.name} />
          <SelectField label="Type" value={form.type} onChange={(e) => set('type', e.target.value as AccountType)} options={ACCOUNT_TYPES} disabled={!!existing} hint={existing ? 'Type cannot be changed.' : undefined} />
          <TextField label="Institution (optional)" placeholder="BPI, GCash, Maya…" maxLength={60} value={form.institution} onChange={(e) => set('institution', e.target.value)} error={errors.institution} />
          <MoneyField
            label={liability ? 'Current amount owed' : 'Opening balance'}
            value={form.openingBalance}
            onChange={(e) => set('openingBalance', e.target.value)}
            error={errors.openingBalance}
            hint={liability ? 'Enter what you owe today as a positive amount.' : undefined}
          />
        </div>

        {isCard && (
          <div className="grid gap-4 rounded-xl border border-line bg-surface-2/50 p-4 sm:grid-cols-2">
            <TextField
              label="Last 4 digits (optional)"
              inputMode="numeric"
              maxLength={4}
              value={form.lastFour}
              onChange={(e) => set('lastFour', e.target.value.replace(/\D/g, ''))}
              error={errors.lastFour}
              hint="Never enter the full card number, CVV or PIN."
            />
            <MoneyField label="Credit limit (optional)" value={form.creditLimit} onChange={(e) => set('creditLimit', e.target.value)} error={errors.creditLimit} />
            <TextField label="Statement day" inputMode="numeric" placeholder="e.g. 15" value={form.statementDay} onChange={(e) => set('statementDay', e.target.value)} error={errors.statementDay} />
            <TextField label="Payment due day" inputMode="numeric" placeholder="e.g. 5" value={form.dueDay} onChange={(e) => set('dueDay', e.target.value)} error={errors.dueDay} />
          </div>
        )}
        {isLoan && (
          <MoneyField
            label="Loan limit (optional)"
            value={form.creditLimit}
            onChange={(e) => set('creditLimit', e.target.value)}
            error={errors.creditLimit}
            hint="The most you can borrow, e.g. your BillEase loan limit."
          />
        )}
        {form.type === 'loan' && (
          <p className="text-xs text-ink-faint">Tip: track a loan either here or under Debts — not both — so it isn't counted twice in net worth.</p>
        )}

        {existing && (
          <SelectField
            label="Status"
            value={form.status}
            onChange={(e) => set('status', e.target.value as 'active' | 'archived')}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'archived', label: 'Archived (hidden from new transactions)' },
            ]}
          />
        )}
        <FormError message={error} />
      </form>
    </Modal>
  )
}
