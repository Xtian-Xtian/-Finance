import { useEffect, useState, type FormEvent } from 'react'
import { Button, FormError, Modal, MoneyField, Notice, Segmented } from '../../components/ui'
import { useFinance } from '../../data/FinanceDataProvider'
import { formatMoney, parseMoney } from '../../lib/money'
import { useAsyncAction } from '../../lib/useAsyncAction'
import { createTransaction } from '../transactions/transactionService'
import { targetBalance } from './accountCalc'
import { isLiability, type Account } from './types'

type Mode = 'balance' | 'owed' | 'available'

/**
 * "Set actual balance": the user types what their bank/lender app shows today and we
 * record a balance adjustment for the difference (never counted as income or expense).
 */
export function UpdateBalanceForm({ account, onClose }: { account: Account | null; onClose: () => void }) {
  const { uid, accounts, categories, balances } = useFinance()
  const [mode, setMode] = useState<Mode>('balance')
  const [amount, setAmount] = useState('')
  const [fieldError, setFieldError] = useState<string>()
  const { busy, error, setError, run } = useAsyncAction()

  useEffect(() => {
    if (!account) return
    setMode(isLiability(account.type) ? 'owed' : 'balance')
    setAmount('')
    setFieldError(undefined)
    setError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.id])

  if (!account) return <Modal open={false} title="" onClose={onClose}>{null}</Modal>

  const acct = account
  const liability = isLiability(acct.type)
  const current = balances.get(acct.id) ?? acct.openingBalance
  const value = parseMoney(amount)
  const target = value === null ? null : targetBalance(acct, { mode, amount: value })
  const delta = target === null ? null : target - current
  const limitLabel = acct.type === 'loan' ? 'loan limit' : 'credit limit'
  const show = (b: number) => (liability ? (b <= 0 ? `${formatMoney(-b)} owed` : `${formatMoney(b)} overpaid`) : formatMoney(b))

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (value === null || target === null || delta === null) {
      setFieldError('Enter the amount shown in your app, e.g. 34.30')
      return
    }
    if (mode === 'available' && !acct.creditLimit) {
      setFieldError(`Set the ${limitLabel} on this account first (Edit).`)
      return
    }
    if (mode === 'available' && value > (acct.creditLimit ?? 0)) {
      setFieldError(`Available cannot be more than the ${limitLabel}.`)
      return
    }
    setFieldError(undefined)
    if (delta === 0) {
      onClose()
      return
    }
    await run(async () => {
      await createTransaction(
        uid,
        {
          type: 'adjustment',
          amount: delta,
          accountId: acct.id,
          toAccountId: '',
          categoryId: '',
          description: `Balance update: set to ${show(target)}`,
          date: new Date(),
          notes: `Previous balance in app: ${show(current)}`,
        },
        accounts,
        categories,
      )
    }, onClose)
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Update balance · ${acct.name}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="update-balance-form" loading={busy} disabled={value === null}>
            Update balance
          </Button>
        </>
      }
    >
      <form id="update-balance-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <p className="text-sm text-ink-muted">
          Enter what your {acct.institution || acct.name} app shows <strong className="text-ink">right now</strong>.
        </p>
        {liability && (
          <Segmented
            label="What your app shows"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'owed', label: 'Amount I owe' },
              { value: 'available', label: acct.type === 'loan' ? 'Available to borrow' : 'Available credit' },
            ]}
          />
        )}
        <MoneyField
          label={mode === 'balance' ? 'Balance today' : mode === 'owed' ? 'Amount owed today' : 'Available today'}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          error={fieldError}
          hint={mode === 'available' ? `Owed = ${limitLabel} ${formatMoney(acct.creditLimit ?? 0)} − available.` : undefined}
          autoFocus
        />
        <div className="rounded-xl border border-line bg-surface-2/50 p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-ink-faint">In the app now</span>
            <span className="tabular">{show(current)}</span>
          </div>
          <div className="mt-1 flex justify-between">
            <span className="text-ink-faint">After update</span>
            <span className="tabular font-medium">{target === null ? '—' : show(target)}</span>
          </div>
          {delta !== null && delta !== 0 && (
            <div className="mt-1 flex justify-between">
              <span className="text-ink-faint">Adjustment recorded</span>
              <span className="tabular">
                {delta > 0 ? '+' : ''}
                {formatMoney(delta)}
              </span>
            </div>
          )}
        </div>
        <Notice>The difference is saved as a balance adjustment. It does not count as income or spending.</Notice>
        <FormError message={error} />
      </form>
    </Modal>
  )
}
