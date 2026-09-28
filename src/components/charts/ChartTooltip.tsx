import { formatMoney } from '../../lib/money'

interface Entry {
  name?: string | number
  value?: number | string
  color?: string
  dataKey?: string | number
}

interface Props {
  active?: boolean
  label?: string | number
  payload?: Entry[]
  footer?: (label: string | number | undefined) => string | undefined
}

export function ChartTooltip({ active, label, payload, footer }: Props) {
  if (!active || !payload?.length) return null
  const note = footer?.(label)
  return (
    <div className="glass-strong rounded-lg border border-line-strong px-3 py-2 text-xs">
      <p className="mb-1.5 font-medium text-ink uppercase">{label}</p>
      <ul className="space-y-1">
        {payload.map((p) => (
          <li key={String(p.dataKey)} className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-2 text-ink-muted">
              <span className="size-2 rounded-full" style={{ background: p.color }} aria-hidden />
              {p.name}
            </span>
            <span className="tabular text-ink">{formatMoney(Number(p.value ?? 0))}</span>
          </li>
        ))}
      </ul>
      {note && <p className="mt-1.5 text-[10px] text-ink-faint">{note}</p>}
    </div>
  )
}
