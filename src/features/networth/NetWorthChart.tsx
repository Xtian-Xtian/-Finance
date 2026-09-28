import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { axisPropsFor, useChartTheme } from '../../components/charts/chartTheme'
import { ChartTooltip } from '../../components/charts/ChartTooltip'
import { formatMoneyCompact } from '../../lib/money'
import type { NetWorthPoint } from './netWorthCalc'

const SOURCE_NOTE: Record<NetWorthPoint['source'], string> = {
  current: 'Live value',
  snapshot: 'Recorded monthly snapshot',
  estimate: 'Estimated from account balances only',
}

export function NetWorthChart({ data, height = 256 }: { data: NetWorthPoint[]; height?: number }) {
  const CHART = useChartTheme()
  const axisProps = axisPropsFor(CHART)
  const bySource = new Map(data.map((d) => [d.label, d.source]))
  return (
    <div style={{ height }} className="w-full" role="img" aria-label="Net worth over the last 12 months">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="nwFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART.netWorth} stopOpacity={0.3} />
              <stop offset="100%" stopColor={CHART.netWorth} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={CHART.grid} vertical={false} />
          <XAxis dataKey="label" {...axisProps} minTickGap={16} />
          <YAxis {...axisProps} width={64} tickFormatter={(v: number) => formatMoneyCompact(v)} />
          <Tooltip content={<ChartTooltip footer={(label) => SOURCE_NOTE[bySource.get(String(label)) ?? 'estimate']} />} />
          <Area type="monotone" dataKey="netWorth" name="Net worth" stroke={CHART.netWorth} strokeWidth={2} fill="url(#nwFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
