import { useEffect, useState, type FormEvent } from 'react'
import { ArrowDownUp, Pencil, Plus, Trash2, TrendingUp } from 'lucide-react'
import { Badge, Button, Card, ConfirmDialog, EmptyState, FormError, IconButton, Modal, MoneyField, PageHeader, Segmented, SelectField, TextField } from '../../components/ui'
import { useFinance } from '../../data/FinanceDataProvider'
import { formatDate, fromDateInput, toDateInput } from '../../lib/dates'
import { formatMoney, parseMoney, sum, toMoneyInput } from '../../lib/money'
import { useAsyncAction } from '../../lib/useAsyncAction'
import { hasErrors, optionalText, requireBusinessDate, requireMoney, requirePositiveMoney, requireText, type Errors } from '../../lib/validation'
import { costBasis, investmentPerformance } from './investmentCalc'
import { addInvestmentTransaction, createInvestment, deleteInvestment, updateInvestment } from './investmentService'
import { ASSET_TYPES, type AssetType, type Investment } from './types'

export function InvestmentsPage() {
  const { uid, investments, investmentTransactions, accounts } = useFinance()
  const [editing, setEditing] = useState<Investment | null | undefined>(undefined)
  const [moving, setMoving] = useState<Investment | null>(null)
  const [deleting, setDeleting] = useState<Investment | null>(null)

  const perf = investments.map((i) => ({ i, p: investmentPerformance(i, investmentTransactions) }))
  const totalValue = sum(perf.map((x) => x.p.currentValue))
  const totalInvested = sum(perf.map((x) => x.p.netInvested))

  return (
    <>
      <PageHeader
        title="Investments"
        description="Track holdings using values you provide."
        actions={
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setEditing(null)}>
            Add holding
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs text-ink-faint">Current value</p>
          <p className="tabular mt-1 text-xl font-semibold">{formatMoney(totalValue)}</p>
        </Card>
        <Card>
          <p className="text-xs text-ink-faint">Net invested</p>
          <p className="tabular mt-1 text-xl font-semibold">{formatMoney(totalInvested)}</p>
        </Card>
        <Card>
          <p className="text-xs text-ink-faint">Unrealised gain / loss</p>
          <p className={`tabular mt-1 text-xl font-semibold ${totalValue - totalInvested >= 0 ? 'text-positive' : 'text-negative'}`}>
            {formatMoney(totalValue - totalInvested)}
          </p>
        </Card>
      </div>

      {investments.length ? (
        <div className="relative overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-surface-2 text-left text-xs text-ink-faint">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Holding</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Quantity</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Avg price</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Net invested</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Current value</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Gain / loss</th>
                <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {perf.map(({ i, p }) => (
                <tr key={i.id} className="hover:bg-surface-2/60">
                  <td className="px-4 py-3">
                    <p className="font-medium">
                      {i.name} {i.symbol && <span className="text-ink-faint">· {i.symbol}</span>}
                    </p>
                    <p className="text-xs text-ink-faint">
                      {ASSET_TYPES.find((t) => t.value === i.assetType)?.label}
                      {i.accountId && ` · ${accounts.find((a) => a.id === i.accountId)?.name ?? ''}`}
                      {i.valuedAt && ` · valued ${formatDate(i.valuedAt)}`}
                    </p>
                  </td>
                  <td className="tabular px-4 py-3 text-right">{i.quantity.toLocaleString('en-PH', { maximumFractionDigits: 8 })}</td>
                  <td className="tabular px-4 py-3 text-right">{formatMoney(i.purchasePrice)}</td>
                  <td className="tabular px-4 py-3 text-right">{formatMoney(p.netInvested)}</td>
                  <td className="tabular px-4 py-3 text-right">{formatMoney(p.currentValue)}</td>
                  <td className="tabular px-4 py-3 text-right">
                    <Badge tone={p.gain >= 0 ? 'positive' : 'negative'}>
                      {p.gain >= 0 ? '+' : ''}
                      {formatMoney(p.gain)}
                      {p.gainPercent != null && ` (${p.gainPercent}%)`}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <IconButton label={`Contribution or withdrawal for ${i.name}`} onClick={() => setMoving(i)}>
                        <ArrowDownUp size={14} />
                      </IconButton>
                      <IconButton label={`Edit ${i.name}`} onClick={() => setEditing(i)}>
                        <Pencil size={14} />
                      </IconButton>
                      <IconButton label={`Delete ${i.name}`} onClick={() => setDeleting(i)}>
                        <Trash2 size={14} />
                      </IconButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState icon={<TrendingUp size={28} />} title="No holdings yet" description="Add stocks, funds, UITFs, bonds, crypto or time deposits." />
      )}
      <p className="mt-6 text-xs text-ink-faint">
        Values are entered by you and are not live market prices. Gains are unrealised and past performance does not guarantee future returns.
      </p>

      <InvestmentForm open={editing !== undefined} existing={editing ?? undefined} onClose={() => setEditing(undefined)} />
      <MovementForm investment={moving} onClose={() => setMoving(null)} />
      <ConfirmDialog open={!!deleting} title="Delete holding?" message={`"${deleting?.name}" and its contribution history will be deleted.`} onConfirm={() => deleteInvestment(uid, deleting!)} onClose={() => setDeleting(null)} />
    </>
  )
}

function InvestmentForm({ open, onClose, existing }: { open: boolean; onClose: () => void; existing?: Investment }) {
  const { uid, accounts } = useFinance()
  const empty = { name: '', symbol: '', assetType: 'stock' as AssetType, accountId: '', quantity: '', purchasePrice: '', currentValue: '' }
  const [form, setForm] = useState(empty)
  const [errors, setErrors] = useState<Errors>({})
  const { busy, error, setError, run } = useAsyncAction()

  useEffect(() => {
    if (!open) return
    setForm(
      existing
        ? {
            name: existing.name,
            symbol: existing.symbol ?? '',
            assetType: existing.assetType,
            accountId: existing.accountId ?? '',
            quantity: String(existing.quantity),
            purchasePrice: toMoneyInput(existing.purchasePrice),
            currentValue: toMoneyInput(existing.currentValue),
          }
        : empty,
    )
    setErrors({})
    setError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existing?.id])

  async function submit(e: FormEvent) {
    e.preventDefault()
    const quantity = /^\d{1,12}(\.\d{1,8})?$/.test(form.quantity.trim()) ? Number(form.quantity) : null
    const price = parseMoney(form.purchasePrice || '0')
    const basis = quantity != null && price != null ? costBasis(quantity, price) : 0
    const value = form.currentValue.trim() ? parseMoney(form.currentValue) : basis
    const errs: Errors = {
      name: requireText(form.name, 'Name', 60),
      symbol: optionalText(form.symbol, 'Symbol', 15),
      quantity: quantity === null ? 'Enter a valid quantity.' : undefined,
      purchasePrice: requireMoney(price, 'Average price'),
      currentValue: requireMoney(value, 'Current value'),
    }
    setErrors(errs)
    if (hasErrors(errs)) return
    const input = {
      name: form.name.trim(),
      symbol: form.symbol.trim().toUpperCase() || undefined,
      assetType: form.assetType,
      accountId: form.accountId || undefined,
      quantity: quantity!,
      purchasePrice: price!,
      currentValue: value!,
      valuedAt: new Date(),
    }
    await run(async () => {
      if (existing) await updateInvestment(uid, existing.id, input)
      else await createInvestment(uid, input, basis)
    }, onClose)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={existing ? 'Edit holding' : 'New holding'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="investment-form" loading={busy}>
            Save
          </Button>
        </>
      }
    >
      <form id="investment-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <TextField label="Name" placeholder="Jollibee Foods" maxLength={60} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} />
        <TextField label="Symbol (optional)" placeholder="JFC" maxLength={15} value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value })} error={errors.symbol} />
        <SelectField label="Asset type" value={form.assetType} onChange={(e) => setForm({ ...form, assetType: e.target.value as AssetType })} options={ASSET_TYPES} />
        <SelectField label="Investment account (optional)" value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })} options={accounts.filter((a) => a.type === 'investment').map((a) => ({ value: a.id, label: a.name }))} placeholder="—" />
        <TextField label="Quantity" inputMode="decimal" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} error={errors.quantity} />
        <MoneyField label="Average purchase price / unit" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })} error={errors.purchasePrice} />
        <MoneyField className="sm:col-span-2" label="Current total value" value={form.currentValue} onChange={(e) => setForm({ ...form, currentValue: e.target.value })} error={errors.currentValue} hint={existing ? 'Update this whenever you check your broker.' : 'Defaults to quantity × price. The purchase is recorded as your initial contribution.'} />
        <div className="sm:col-span-2">
          <FormError message={error} />
        </div>
      </form>
    </Modal>
  )
}

function MovementForm({ investment, onClose }: { investment: Investment | null; onClose: () => void }) {
  const { uid } = useFinance()
  const [kind, setKind] = useState<'contribution' | 'withdrawal'>('contribution')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState('')
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const { busy, error, setError, run } = useAsyncAction()

  useEffect(() => {
    if (!investment) return
    setKind('contribution')
    setAmount('')
    setDate(toDateInput(new Date()))
    setNote('')
    setErrors({})
    setError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [investment?.id])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!investment) return
    const value = parseMoney(amount)
    const d = fromDateInput(date)
    const errs: Errors = { amount: requirePositiveMoney(value), date: requireBusinessDate(d), note: optionalText(note, 'Note', 200) }
    setErrors(errs)
    if (hasErrors(errs)) return
    await run(() => addInvestmentTransaction(uid, investment, { kind, amount: value!, date: d!, note }), onClose)
  }

  return (
    <Modal
      open={!!investment}
      onClose={onClose}
      title={investment?.name ?? ''}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="movement-form" loading={busy}>
            Record
          </Button>
        </>
      }
    >
      <form id="movement-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Segmented label="Movement type" value={kind} onChange={setKind} options={[{ value: 'contribution', label: 'Contribution' }, { value: 'withdrawal', label: 'Withdrawal' }]} />
        <div className="grid gap-4 sm:grid-cols-2">
          <MoneyField label="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} error={errors.amount} />
          <TextField label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} error={errors.date} />
        </div>
        <TextField label="Note (optional)" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} error={errors.note} />
        <p className="text-xs text-ink-faint">Remember to update the holding's current value after buying or selling.</p>
        <FormError message={error} />
      </form>
    </Modal>
  )
}
