import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

const control =
  'w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none aria-[invalid=true]:border-negative'

interface FieldShellProps {
  label: string
  error?: string
  hint?: ReactNode
  children: (id: string, describedBy: string | undefined) => ReactNode
  className?: string
}

function FieldShell({ label, error, hint, children, className }: FieldShellProps) {
  const id = useId()
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-xs font-medium text-ink-muted">
        {label}
      </label>
      {children(id, describedBy)}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-negative" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-ink-faint">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: ReactNode }

export function TextField({ label, error, hint, className, ...rest }: InputProps) {
  return (
    <FieldShell label={label} error={error} hint={hint} className={className}>
      {(id, describedBy) => (
        <input id={id} aria-invalid={!!error} aria-describedby={describedBy} className={cn(control, 'h-10')} {...rest} />
      )}
    </FieldShell>
  )
}

/** Money input: free text parsed into centavos by the caller (lib/money parseMoney). */
export function MoneyField({ label, error, hint, className, ...rest }: InputProps) {
  return (
    <FieldShell label={label} error={error} hint={hint} className={className}>
      {(id, describedBy) => (
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-ink-faint">₱</span>
          <input
            id={id}
            inputMode="decimal"
            autoComplete="off"
            aria-invalid={!!error}
            aria-describedby={describedBy}
            className={cn(control, 'tabular h-10 pl-7')}
            placeholder="0.00"
            {...rest}
          />
        </div>
      )}
    </FieldShell>
  )
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string
  error?: string
  hint?: ReactNode
  options: Array<{ value: string; label: string }>
  placeholder?: string
}

export function SelectField({ label, error, hint, options, placeholder, className, ...rest }: SelectProps) {
  return (
    <FieldShell label={label} error={error} hint={hint} className={className}>
      {(id, describedBy) => (
        <select id={id} aria-invalid={!!error} aria-describedby={describedBy} className={cn(control, 'h-10')} {...rest}>
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </FieldShell>
  )
}

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; error?: string; hint?: ReactNode }

export function TextAreaField({ label, error, hint, className, ...rest }: TextAreaProps) {
  return (
    <FieldShell label={label} error={error} hint={hint} className={className}>
      {(id, describedBy) => (
        <textarea id={id} aria-invalid={!!error} aria-describedby={describedBy} rows={3} className={cn(control, 'py-2')} {...rest} />
      )}
    </FieldShell>
  )
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null
  return (
    <div role="alert" className="rounded-lg border border-negative/30 bg-negative/10 px-3 py-2 text-sm text-negative">
      {message}
    </div>
  )
}
