import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Button, FormError, Modal, MoneyField, Segmented, SelectField, TextAreaField, TextField } from '../../components/ui'
import { useFinance } from '../../data/FinanceDataProvider'
import { fromDateInput, toDateInput } from '../../lib/dates'
import { parseMoney, toMoneyInput } from '../../lib/money'
import { useAsyncAction } from '../../lib/useAsyncAction'
import { hasErrors, type Errors } from '../../lib/validation'
import { createTransaction, draftFromTransaction, updateTransaction } from './transactionService'
import { validateTransaction } from './transactionValidation'
import type { Transaction, TransactionType } from './types'
import { TRANSACTION_TYPES } from './types'

interface Props {
  open: boolean
  onClose: () => void
  existing?: Transaction
  defaultType?: TransactionType
}

interface FormState {
  type: TransactionType
  amount: string
  accountId: string
  toAccountId: string
  categoryId: string
  description: string
  date: string
  notes: string
}

export function TransactionForm({ open, onClose, existing, defaultType = 'expense' }: Props) {
  const { uid, accounts, categories } = useFinance()
  const activeAccounts = accounts.filter((a) => a.status === 'active' || a.id === (existing && draftFromTransaction(existing).accountId))
  const [form, setForm] = useState<FormState>(() => initialState())
  const [errors, setErrors] = useState<Errors>({})
  const { busy, error, setError, run } = useAsyncAction()

  function initialState(): FormState {
    if (existing) {
      const d = draftFromTransaction(existing)
      return { ...d, amount: toMoneyInput(d.amount ?? 0), date: toDateInput(d.date) }
    }
    return {
      type: defaultType,
      amount: '',
      accountId: activeAccounts[0]?.id ?? '',
      toAccountId: '',
      categoryId: '',
      description: '',
      date: toDateInput(new Date()),
      notes: '',
    }
  }

  useEffect(() => {
    if (open) {
      setForm(initialState())
      setErrors({})
      setError(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existing?.id])

  const categoryOptions = useMemo(
    () => categories.filter((c) => c.type === form.type).map((c) => ({ value: c.id, label: c.name })),
    [categories, form.type],
  )
  const accountOptions = activeAccounts.map((a) => ({ value: a.id, label: a.name }))

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }))

  async function submit(e: FormEvent) {
    e.preventDefault()
    const draft = {
      type: form.type,
      amount: parseMoney(form.amount, { allowNegative: form.type === 'adjustment' }),
      accountId: form.accountId,
      toAccountId: form.toAccountId,
      categoryId: form.categoryId,
      description: form.description,
      date: fromDateInput(form.date),
      notes: form.notes,
    }
    const next = validateTransaction(draft, accounts, categories)
    setErrors(next)
    if (hasErrors(next)) return
    await run(async () => {
      if (existing) await updateTransaction(uid, existing.id, draft, accounts, categories)
      else await createTransaction(uid, draft, accounts, categories)
    }, onClose)
  }

  const isTransfer = form.type === 'transfer'

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={existing ? 'Edit transaction' : 'New transaction'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="transaction-form" loading={busy}>
            {existing ? 'Save changes' : 'Add transaction'}
          </Button>
        </>
      }
    >
      {accounts.length === 0 ? (
        <p className="text-sm text-ink-muted">Add an account first — every transaction belongs to an account.</p>
      ) : (
        <form id="transaction-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <Segmented
            label="Transaction type"
            value={form.type}
            onChange={(type) => setForm((f) => ({ ...f, type, categoryId: '' }))}
            options={TRANSACTION_TYPES.map((t) => ({ value: t.value, label: t.value === 'adjustment' ? 'Adjust' : t.label }))}
          />
          {isTransfer && <p className="text-xs text-ink-faint">Transfers move money between your accounts and are not counted as income or expense.</p>}
          {form.type === 'adjustment' && <p className="text-xs text-ink-faint">Corrects an account balance. Use a negative amount to decrease it. Not counted as income or expense.</p>}

          <div className="grid gap-4 sm:grid-cols-2">
            <MoneyField label="Amount" value={form.amount} onChange={(e) => set('amount', e.target.value)} error={errors.amount} />
            <TextField label="Date" type="date" value={form.date} onChange={(e) => set('date', e.target.value)} error={errors.date} />
            <SelectField
              label={isTransfer ? 'From account' : 'Account'}
              value={form.accountId}
              onChange={(e) => set('accountId', e.target.value)}
              options={accountOptions}
              placeholder="Select account"
              error={errors.accountId}
            />
            {isTransfer ? (
              <SelectField
                label="To account"
                value={form.toAccountId}
                onChange={(e) => set('toAccountId', e.target.value)}
                options={accountOptions.filter((o) => o.value !== form.accountId)}
                placeholder="Select account"
                error={errors.toAccountId}
              />
            ) : form.type !== 'adjustment' ? (
              <SelectField
                label="Category"
                value={form.categoryId}
                onChange={(e) => set('categoryId', e.target.value)}
                options={categoryOptions}
                placeholder="Select category"
                error={errors.categoryId}
              />
            ) : null}
          </div>
          <TextField label="Description" maxLength={120} value={form.description} onChange={(e) => set('description', e.target.value)} error={errors.description} />
          <TextAreaField label="Notes (optional)" maxLength={500} value={form.notes} onChange={(e) => set('notes', e.target.value)} error={errors.notes} />
          <FormError message={error} />
        </form>
      )}
    </Modal>
  )
}
