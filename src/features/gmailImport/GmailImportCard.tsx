import { useState } from 'react'
import { Check, Copy, Mail } from 'lucide-react'
import { Button, Card, CardHeader, ConfirmDialog, FormError, Notice, SelectField } from '../../components/ui'
import { useFinance } from '../../data/FinanceDataProvider'
import { auth } from '../../lib/firebase'
import { logAudit } from '../audit/auditService'
import { deleteImportedTransactions } from './gmailImportService'
import { buildAppsScript, buildTransferRules, DEFAULT_CATEGORY_KEYWORDS } from './appsScript'

export function GmailImportCard() {
  const { uid, accounts, categories, transactions } = useFinance()
  const active = accounts.filter((a) => a.status === 'active')
  const income = categories.filter((c) => c.type === 'income')
  const expense = categories.filter((c) => c.type === 'expense')

  const [accountId, setAccountId] = useState(() => active.find((a) => a.institution?.toUpperCase().includes('BPI') || /bpi/i.test(a.name))?.id ?? active[0]?.id ?? '')
  const [incomeId, setIncomeId] = useState(() => income.find((c) => c.name === 'Other Income')?.id ?? income[0]?.id ?? '')
  const [expenseId, setExpenseId] = useState(() => expense.find((c) => c.name === 'Other Expense')?.id ?? expense[0]?.id ?? '')
  const [script, setScript] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)

  const billease = active.find((a) => /billease/i.test(`${a.name} ${a.institution ?? ''}`))
  const importedCount = transactions.filter((t) => t.source === 'gmail').length

  async function generate() {
    setError(null)
    const user = auth.currentUser
    if (!user) return
    if (!accountId || !incomeId || !expenseId) {
      setError('Choose a default account and categories first.')
      return
    }
    const byName = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]))
    const accountsByLastFour: Record<string, string> = {}
    for (const a of active) if (a.lastFour) accountsByLastFour[a.lastFour] = a.id

    setScript(
      buildAppsScript({
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        uid,
        refreshToken: user.refreshToken,
        defaultAccountId: accountId,
        accountsByLastFour,
        incomeCategoryId: incomeId,
        expenseCategoryId: expenseId,
        transferRules: buildTransferRules(active, accountId),
        billeaseAccountId: billease?.id ?? null,
        categoryRules: DEFAULT_CATEGORY_KEYWORDS.flatMap(([pattern, name]) => {
          const id = byName.get(name.toLowerCase())
          return id ? [[pattern, id] as [string, string]] : []
        }),
      }),
    )
    setCopied(false)
    await logAudit(uid, { action: 'auth.import_key_created', entityType: 'auth', details: 'Gmail auto-import script generated' })
  }

  async function copy() {
    if (!script) return
    try {
      await navigator.clipboard.writeText(script)
      setCopied(true)
    } catch {
      setError('Could not copy automatically — select the text and copy it manually.')
    }
  }

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Mail size={16} className="text-accent" aria-hidden /> Gmail auto-import (BPI + BillEase)
          </span>
        }
        subtitle={importedCount ? `${importedCount} transaction${importedCount === 1 ? '' : 's'} imported so far` : 'Automatically adds BPI email alerts as transactions — free.'}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField label="Default account" value={accountId} onChange={(e) => setAccountId(e.target.value)} options={active.map((a) => ({ value: a.id, label: a.name }))} placeholder="Select" hint="Used when the email's last 4 digits don't match an account." />
        <SelectField label="Income category" value={incomeId} onChange={(e) => setIncomeId(e.target.value)} options={income.map((c) => ({ value: c.id, label: c.name }))} placeholder="Select" />
        <SelectField label="Fallback expense category" value={expenseId} onChange={(e) => setExpenseId(e.target.value)} options={expense.map((c) => ({ value: c.id, label: c.name }))} placeholder="Select" hint="Known merchants (Grab, Netflix, Meralco…) are auto-categorised." />
      </div>

      <p className="mt-3 text-xs text-ink-faint">
        Tip: set <span className="text-ink-muted">Last 4 digits</span> on your accounts (e.g. 0308 for your BPI debit card) so imports land in the right account.
      </p>

      {!billease && (
        <p className="mt-2 text-xs text-ink-faint">
          To import BillEase purchases too, add an account named <span className="text-ink-muted">BillEase</span> (type: Loan) first, then generate the script.
        </p>
      )}
      <FormError message={error} />

      {!script ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="primary" onClick={generate} disabled={!active.length}>
            Generate my import script
          </Button>
          {importedCount > 0 && (
            <Button variant="ghost" onClick={() => setConfirmReset(true)}>
              Redo imports…
            </Button>
          )}
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          <Notice tone="warning">
            This script contains a private connection key that acts as you. Only paste it into <strong>your own</strong> Google Apps Script — never share it.
            To revoke it later, run <code>disconnect</code> in the script and change your Finance password.
          </Notice>
          <div className="flex gap-2">
            <Button variant="primary" icon={copied ? <Check size={16} /> : <Copy size={16} />} onClick={copy}>
              {copied ? 'Copied' : 'Copy script'}
            </Button>
            <Button variant="ghost" onClick={() => setScript(null)}>
              Hide
            </Button>
          </div>
          <textarea readOnly value={script} rows={8} className="w-full rounded-lg border border-line bg-surface-2 p-3 font-mono text-[11px] text-ink-muted" aria-label="Generated Apps Script" />
          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-ink-muted">
            <li>
              Open{' '}
              <a href="https://script.google.com/home/projects/create" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                script.google.com → New project
              </a>{' '}
              while signed in to the Gmail that receives BPI emails.
            </li>
            <li>Delete the sample code, paste the script, and click Save (💾). Name it "Finance import".</li>
            <li>
              In the function dropdown pick <code>dryRun</code> → <strong>Run</strong> → allow access. Check the log to see what would be imported.
            </li>
            <li>
              Pick <code>setup</code> → <strong>Run</strong>. It imports the last 30 days and then runs every 10 minutes.
            </li>
            <li>Delete the long <code>SETUP_KEY</code> value in the script (leave <code>''</code>) and save.</li>
          </ol>
        </div>
      )}
      <ConfirmDialog
        open={confirmReset}
        title="Redo Gmail imports?"
        message={`This deletes the ${importedCount} imported transaction(s), including any edits you made to them. Then generate a new script, paste it into Apps Script, and run "reimport" to import them again with the latest rules.`}
        confirmLabel="Delete imported"
        onConfirm={async () => void (await deleteImportedTransactions(uid, transactions))}
        onClose={() => setConfirmReset(false)}
      />
    </Card>
  )
}
