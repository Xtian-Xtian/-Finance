import { useState, type FormEvent } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { Button, Card, CardHeader, ConfirmDialog, FormError, IconButton, Modal, Segmented, TextField } from '../../components/ui'
import { useFinance } from '../../data/FinanceDataProvider'
import { useAsyncAction } from '../../lib/useAsyncAction'
import { requireText } from '../../lib/validation'
import { canDeleteCategory, createCategory, deleteCategory, updateCategory } from './categoryService'
import type { Category, CategoryType } from './types'

export function CategoryManager() {
  const { uid, categories, transactions, budgets } = useFinance()
  const [tab, setTab] = useState<CategoryType>('expense')
  const [editing, setEditing] = useState<Category | null | undefined>(undefined)
  const [deleting, setDeleting] = useState<Category | null>(null)
  const visible = categories.filter((c) => c.type === tab)
  const deletable = deleting ? canDeleteCategory(deleting.id, transactions, budgets) : false

  return (
    <Card>
      <CardHeader
        title="Categories"
        subtitle="Used to classify income and expenses."
        action={
          <Button size="sm" icon={<Plus size={14} />} onClick={() => setEditing(null)}>
            Add
          </Button>
        }
      />
      <Segmented label="Category type" value={tab} onChange={setTab} options={[{ value: 'expense', label: 'Expense' }, { value: 'income', label: 'Income' }]} />
      <ul className="mt-4 divide-y divide-line">
        {visible.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-3 py-2 text-sm">
            <span className="flex items-center gap-2">
              <span className="size-3 rounded-full" style={{ background: c.color }} aria-hidden />
              {c.name}
            </span>
            <div className="flex gap-1">
              <IconButton label={`Edit ${c.name}`} onClick={() => setEditing(c)}>
                <Pencil size={14} />
              </IconButton>
              <IconButton label={`Delete ${c.name}`} onClick={() => setDeleting(c)}>
                <Trash2 size={14} />
              </IconButton>
            </div>
          </li>
        ))}
      </ul>
      <CategoryForm open={editing !== undefined} existing={editing ?? undefined} type={tab} onClose={() => setEditing(undefined)} />
      <ConfirmDialog
        open={!!deleting}
        title="Delete category?"
        message={deletable ? `"${deleting?.name}" will be deleted.` : 'This category is used by transactions or budgets and cannot be deleted. Rename it instead.'}
        confirmLabel={deletable ? 'Delete' : 'OK'}
        onConfirm={async () => {
          if (deleting && deletable) await deleteCategory(uid, deleting)
        }}
        onClose={() => setDeleting(null)}
      />
    </Card>
  )
}

function CategoryForm({ open, onClose, existing, type }: { open: boolean; onClose: () => void; existing?: Category; type: CategoryType }) {
  const { uid } = useFinance()
  const [name, setName] = useState('')
  const [color, setColor] = useState('#2dd4bf')
  const [nameError, setNameError] = useState<string>()
  const { busy, error, run } = useAsyncAction()
  const [lastOpen, setLastOpen] = useState(false)

  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) {
      setName(existing?.name ?? '')
      setColor(existing?.color ?? '#2dd4bf')
      setNameError(undefined)
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const err = requireText(name, 'Name', 40)
    setNameError(err)
    if (err) return
    await run(async () => {
      if (existing) await updateCategory(uid, existing.id, { name: name.trim(), color })
      else await createCategory(uid, { name: name.trim(), type, color })
    }, onClose)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={existing ? 'Edit category' : `New ${type} category`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="category-form" loading={busy}>
            Save
          </Button>
        </>
      }
    >
      <form id="category-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <TextField label="Name" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} error={nameError} />
        <label className="flex items-center gap-3 text-sm text-ink-muted">
          Colour
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-14 cursor-pointer rounded border border-line bg-transparent" />
        </label>
        <FormError message={error} />
      </form>
    </Modal>
  )
}
