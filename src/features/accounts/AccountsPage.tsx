import { useState } from 'react'
import { Pencil, Plus, RefreshCw, Trash2, WalletCards } from 'lucide-react'
import { Badge, Button, Card, ConfirmDialog, EmptyState, IconButton, PageHeader, ProgressBar } from '../../components/ui'
import { useFinance } from '../../data/FinanceDataProvider'
import { formatMoney } from '../../lib/money'
import { AccountForm } from './AccountForm'
import { UpdateBalanceForm } from './UpdateBalanceForm'
import { creditCardUsage, maskLastFour } from './accountCalc'
import { canDeleteAccount, deleteAccount } from './accountService'
import { CreditCardVisual } from './CreditCardVisual'
import { accountTypeLabel, ACCOUNT_TYPES, isLiability, type Account } from './types'

export function AccountsPage() {
  const { uid, accounts, balances, transactions, netWorth } = useFinance()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Account | undefined>()
  const [deleting, setDeleting] = useState<Account | null>(null)
  const [updating, setUpdating] = useState<Account | null>(null)

  const edit = (a?: Account) => {
    setEditing(a)
    setFormOpen(true)
  }

  const groups = ACCOUNT_TYPES.map((t) => ({ ...t, items: accounts.filter((a) => a.type === t.value) })).filter((g) => g.items.length)

  return (
    <>
      <PageHeader
        title="Accounts"
        description="Cash, bank, e-wallet, credit card, investment and loan accounts."
        actions={
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => edit()}>
            Add account
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs text-ink-faint">Assets</p>
          <p className="tabular mt-1 text-xl font-semibold">{formatMoney(netWorth.assets)}</p>
        </Card>
        <Card>
          <p className="text-xs text-ink-faint">Liabilities</p>
          <p className="tabular mt-1 text-xl font-semibold text-negative">{formatMoney(netWorth.liabilities)}</p>
        </Card>
        <Card>
          <p className="text-xs text-ink-faint">Net worth</p>
          <p className="tabular mt-1 text-xl font-semibold text-accent">{formatMoney(netWorth.netWorth)}</p>
        </Card>
      </div>

      {!accounts.length && (
        <EmptyState
          icon={<WalletCards size={28} />}
          title="No accounts yet"
          description="Add where your money lives — e.g. BPI Savings, GCash, cash on hand. Never enter online banking credentials."
          action={<Button variant="primary" onClick={() => edit()}>Add your first account</Button>}
        />
      )}

      <div className="flex flex-col gap-8">
        {groups.map((g) => (
          <section key={g.value}>
            <h2 className="mb-3 text-sm font-medium text-ink-muted">{g.label}</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {g.items.map((a) => {
                const balance = balances.get(a.id) ?? a.openingBalance
                const usage = a.type === 'credit_card' ? creditCardUsage(a, balance) : null
                return (
                  <Card key={a.id} className={a.status === 'archived' ? 'opacity-60' : ''}>
                    <div className="mb-4">
                        <CreditCardVisual account={a} balance={balance} />
                      </div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{a.name}</p>
                        <p className="truncate text-xs text-ink-faint">
                          {[a.institution, accountTypeLabel(a.type), maskLastFour(a.lastFour)].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <IconButton label={`Update balance of ${a.name}`} onClick={() => setUpdating(a)}>
                          <RefreshCw size={14} />
                        </IconButton>
                        <IconButton label={`Edit ${a.name}`} onClick={() => edit(a)}>
                          <Pencil size={14} />
                        </IconButton>
                        <IconButton label={`Delete ${a.name}`} onClick={() => setDeleting(a)}>
                          <Trash2 size={14} />
                        </IconButton>
                      </div>
                    </div>
                    <p className={`tabular mt-4 text-2xl font-semibold ${balance < 0 ? 'text-negative' : ''}`}>
                      {isLiability(a.type) ? (balance <= 0 ? `${formatMoney(-balance)} owed` : `${formatMoney(balance)} overpaid`) : formatMoney(balance)}
                    </p>
                    {usage && usage.limit > 0 && (
                      <div className="mt-3 flex flex-col gap-1.5">
                        <ProgressBar label="Credit utilisation" value={usage.utilisation} tone={usage.utilisation > 70 ? 'negative' : usage.utilisation > 30 ? 'warning' : 'accent'} />
                        <p className="text-xs text-ink-faint">
                          {usage.utilisation}% of {formatMoney(usage.limit)} · {formatMoney(usage.available)} available
                          {a.dueDay ? ` · due day ${a.dueDay}` : ''}
                        </p>
                      </div>
                    )}
                    {a.status === 'archived' && (
                      <div className="mt-3">
                        <Badge>Archived</Badge>
                      </div>
                    )}
                  </Card>
                )
              })}
            </div>
          </section>
        ))}
      </div>

      <UpdateBalanceForm account={updating} onClose={() => setUpdating(null)} />
      <AccountForm open={formOpen} existing={editing} onClose={() => setFormOpen(false)} />
      <ConfirmDialog
        open={!!deleting}
        title="Delete account?"
        message={
          deleting && !canDeleteAccount(deleting.id, transactions)
            ? 'This account has transactions. Archive it instead (Edit → Status) to keep your history intact.'
            : `"${deleting?.name}" will be permanently deleted.`
        }
        confirmLabel={deleting && !canDeleteAccount(deleting.id, transactions) ? 'OK' : 'Delete'}
        onConfirm={async () => {
          if (deleting && canDeleteAccount(deleting.id, transactions)) await deleteAccount(uid, deleting)
        }}
        onClose={() => setDeleting(null)}
      />
    </>
  )
}
