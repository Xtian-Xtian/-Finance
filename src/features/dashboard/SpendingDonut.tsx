import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { ChartTooltip } from '../../components/charts/ChartTooltip'
import { formatMoney, percent, sum } from '../../lib/money'
import type { CategorySpend } from '../transactions/transactionCalc'

export function SpendingDonut({ data }: { data: CategorySpend[] }) {
  const top = data.slice(0, 5)
  const rest = sum(data.slice(5).map((d) => d.amount))
  const slices = rest > 0 ? [...top, { categoryId: 'other', name: 'Other', color: '#52525b', amount: rest }] : top
  const total = sum(slices.map((s) => s.amount))

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="relative mx-auto size-40 shrink-0" role="img" aria-label="Spending by category chart">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={slices} dataKey="amount" nameKey="name" innerRadius={52} outerRadius={72} paddingAngle={2} stroke="none">
              {slices.map((s) => (
                <Cell key={s.categoryId} fill={s.color} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[10px] text-ink-faint">Total</span>
          <span className="tabular text-sm font-semibold">{formatMoney(total)}</span>
        </div>
      </div>
      <ul className="flex-1 space-y-2 text-sm">
        {slices.map((s) => (
          <li key={s.categoryId} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2 text-ink-muted">
              <span className="size-2 shrink-0 rounded-full" style={{ background: s.color }} aria-hidden />
              <span className="truncate">{s.name}</span>
            </span>
            <span className="tabular shrink-0 text-ink">
              {formatMoney(s.amount)} <span className="text-xs text-ink-faint">{percent(s.amount, total)}%</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
