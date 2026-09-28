import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Download, Plus, Receipt, Search } from 'lucide-react'
import { Button, Card, ConfirmDialog, EmptyState, IconButton, PageHeader, SelectField } from '../../components/ui'
import { useFinance } from '../../data/FinanceDataProvider'
import { downloadCsv } from '../../lib/csv'
import { toDateInput } from '../../lib/dates'
import { formatMoney, toMoneyInput } from '../../lib/money'
import { TransactionForm } from './TransactionForm'
import { TransactionDetail } from './TransactionDetail'
import { TransactionTable } from './TransactionTable'
import { deleteTransaction } from './transactionService'
import { accountIdsOf, TRANSACTION_TYPES, type Transaction } from './types'

const PAGE_SIZE = 20

export function TransactionsPage() {
  const { uid, transactions, accounts, categories } = useFinance()
  const [params] = useSearchParams()
  const urlQuery = params.get('q') ?? ''
  const [search, setSearch] = useState(urlQuery)
  // A new search from the top bar (?q=) replaces the current search.
  const [lastUrlQuery, setLastUrlQuery] = useState(urlQuery)
  if (urlQuery !== lastUrlQuery) {
    setLastUrlQuery(urlQuery)
    setSearch(urlQuery)
  }
  const [type, setType] = useState('')
  const [accountId, setAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [page, setPage] = useState(0)
  const [editing, setEditing] = useState<Transaction | undefined>()
  const [formOpen, setFormOpen] = useState(false)
  const [deleting, setDeleting] = useState<Transaction | null>(null)
  const [viewingId, setViewingId] = useState<string | null>(null)
  const viewing = transactions.find((t) => t.id === viewingId) ?? null

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return transactions.filter(
      (t) =>
        (!type || t.type === type) &&
        (!accountId || accountIdsOf(t).includes(accountId)) &&
        (!categoryId || ((t.type === 'income' || t.type === 'expense') && t.categoryId === categoryId)) &&
        (!q || t.description.toLowerCase().includes(q) || (t.notes ?? '').toLowerCase().includes(q)),
    )
  }, [transactions, search, type, accountId, categoryId])

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = Math.min(page, pages - 1)
  const visible = filtered.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE)

  function exportCsv() {
    const name = (id?: string) => accounts.find((a) => a.id === id)?.name ?? ''
    const cat = (id?: string) => categories.find((c) => c.id === id)?.name ?? ''
    downloadCsv(`transactions-${toDateInput(new Date())}.csv`, [
      ['Date', 'Type', 'Description', 'Category', 'Account', 'To account', 'Amount (PHP)', 'Notes'],
      ...filtered.map((t) => [
        toDateInput(t.date),
        t.type,
        t.description,
        t.type === 'income' || t.type === 'expense' ? cat(t.categoryId) : '',
        name(t.type === 'transfer' ? t.fromAccountId : t.accountId),
        t.type === 'transfer' ? name(t.toAccountId) : '',
        toMoneyInput(t.type === 'expense' ? -t.amount : t.amount),
        t.notes ?? '',
      ]),
    ])
  }

  const reset = () => setPage(0)

  return (
    <>
      <PageHeader
        title="Transactions"
        description={`${filtered.length} transaction${filtered.length === 1 ? '' : 's'}`}
        actions={
          <>
            <Button icon={<Download size={16} />} onClick={exportCsv} disabled={!filtered.length}>
              Export CSV
            </Button>
            <Button
              variant="primary"
              icon={<Plus size={16} />}
              onClick={() => {
                setEditing(undefined)
                setFormOpen(true)
              }}
            >
              Add transaction
            </Button>
          </>
        }
      />

      <Card>
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="relative flex flex-col gap-1.5">
            <span className="text-xs font-medium text-ink-muted">Search</span>
            <Search size={14} className="pointer-events-none absolute bottom-3 left-3 text-ink-faint" aria-hidden />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                reset()
              }}
              placeholder="Description or notes"
              className="h-10 rounded-lg border border-line bg-surface-2 pr-3 pl-9 text-sm focus:border-accent focus:outline-none"
            />
          </label>
          <SelectField label="Type" value={type} onChange={(e) => { setType(e.target.value); reset() }} options={TRANSACTION_TYPES} placeholder="All types" />
          <SelectField
            label="Account"
            value={accountId}
            onChange={(e) => { setAccountId(e.target.value); reset() }}
            options={accounts.map((a) => ({ value: a.id, label: a.name }))}
            placeholder="All accounts"
          />
          <SelectField
            label="Category"
            value={categoryId}
            onChange={(e) => { setCategoryId(e.target.value); reset() }}
            options={categories.map((c) => ({ value: c.id, label: `${c.name} (${c.type})` }))}
            placeholder="All categories"
          />
        </div>

        {visible.length ? (
          <>
            <TransactionTable
              transactions={visible}
              onEdit={(t) => {
                setEditing(t)
                setFormOpen(true)
              }}
              onDelete={setDeleting}
              onView={(t) => setViewingId(t.id)}
            />
            <div className="mt-4 flex items-center justify-between text-xs text-ink-faint">
              <span>
                Showing {visible.length} of {filtered.length}
              </span>
              <div className="flex items-center gap-2">
                <IconButton label="Previous page" disabled={current === 0} onClick={() => setPage(current - 1)}>
                  <ChevronLeft size={14} />
                </IconButton>
                <span>
                  Page {current + 1} of {pages}
                </span>
                <IconButton label="Next page" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
                  <ChevronRight size={14} />
                </IconButton>
              </div>
            </div>
          </>
        ) : (
          <EmptyState icon={<Receipt size={28} />} title="No transactions found" description="Record income, expenses and transfers to see them here." />
        )}
      </Card>

      <TransactionDetail
        transaction={viewing}
        onClose={() => setViewingId(null)}
        onEdit={(t) => {
          setViewingId(null)
          setEditing(t)
          setFormOpen(true)
        }}
        onDelete={(t) => {
          setViewingId(null)
          setDeleting(t)
        }}
      />
      <TransactionForm open={formOpen} existing={editing} onClose={() => setFormOpen(false)} />
      <ConfirmDialog
        open={!!deleting}
        title="Delete transaction?"
        message={deleting ? `"${deleting.description}" (${formatMoney(deleting.amount)}) will be permanently removed and account balances recalculated.` : ''}
        onConfirm={() => deleteTransaction(uid, deleting!)}
        onClose={() => setDeleting(null)}
      />
    </>
  )
}
