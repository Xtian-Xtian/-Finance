import { useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { axisPropsFor, useChartTheme } from '../../components/charts/chartTheme'
import { ChartTooltip } from '../../components/charts/ChartTooltip'
import { Button, Card, CardHeader, PageHeader, SelectField } from '../../components/ui'
import { useFinance } from '../../data/FinanceDataProvider'
import { downloadCsv } from '../../lib/csv'
import { formatMoney, formatMoneyCompact, sum, toMoneyInput } from '../../lib/money'
import { SpendingDonut } from '../dashboard/SpendingDonut'
import { NetWorthChart } from '../networth/NetWorthChart'
import { useNetWorthHistory } from '../networth/useNetWorthHistory'
import { spendingByCategory } from '../transactions/transactionCalc'
import { yearlyReport, yearsWithData } from './reportCalc'

export function ReportsPage() {
  const CHART = useChartTheme()
  const axisProps = axisPropsFor(CHART)
  const { transactions, categories, netWorth } = useFinance()
  const years = useMemo(() => yearsWithData(transactions), [transactions])
  const [year, setYear] = useState(years[0])
  const rows = useMemo(() => yearlyReport(transactions, year), [transactions, year])
  const categoriesYear = useMemo(() => spendingByCategory(transactions, categories, new Date(year, 0, 1), new Date(year + 1, 0, 1)), [transactions, categories, year])
  const history = useNetWorthHistory(12)

  const income = sum(rows.map((r) => r.income))
  const expenses = sum(rows.map((r) => r.expenses))

  function exportReport() {
    downloadCsv(`report-${year}.csv`, [
      ['Month', 'Income (PHP)', 'Expenses (PHP)', 'Net (PHP)', 'Savings rate %'],
      ...rows.map((r) => [r.label, toMoneyInput(r.income), toMoneyInput(r.expenses), toMoneyInput(r.net), r.savingsRate ?? '']),
      ['Total', toMoneyInput(income), toMoneyInput(expenses), toMoneyInput(income - expenses), income ? Math.round(((income - expenses) / income) * 100) : ''],
    ])
  }

  return (
    <>
      <PageHeader
        title="Reports"
        description="Yearly income, expenses, category breakdown and net worth."
        actions={
          <>
            <SelectField label="Year" className="w-32" value={String(year)} onChange={(e) => setYear(Number(e.target.value))} options={years.map((y) => ({ value: String(y), label: String(y) }))} />
            <Button className="self-end" icon={<Download size={16} />} onClick={exportReport}>
              Export CSV
            </Button>
          </>
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs text-ink-faint">Income {year}</p>
          <p className="tabular mt-1 text-xl font-semibold text-positive">{formatMoney(income)}</p>
        </Card>
        <Card>
          <p className="text-xs text-ink-faint">Expenses {year}</p>
          <p className="tabular mt-1 text-xl font-semibold">{formatMoney(expenses)}</p>
        </Card>
        <Card>
          <p className="text-xs text-ink-faint">Net {year}</p>
          <p className={`tabular mt-1 text-xl font-semibold ${income - expenses >= 0 ? 'text-accent' : 'text-negative'}`}>{formatMoney(income - expenses)}</p>
        </Card>
      </div>

      <Card className="mb-4">
        <CardHeader title="Income vs expenses by month" />
        <div className="h-72" role="img" aria-label={`Monthly income and expenses for ${year}`}>
          <ResponsiveContainer>
            <BarChart data={rows} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="label" {...axisProps} />
              <YAxis {...axisProps} width={64} tickFormatter={(v: number) => formatMoneyCompact(v)} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: '#ffffff08' }} />
              <Legend wrapperStyle={{ fontSize: 12, color: CHART.axis }} />
              <Bar dataKey="income" name="Income" fill={CHART.income} radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" name="Expenses" fill={CHART.expenses} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={`Spending by category · ${year}`} />
          {categoriesYear.length ? <SpendingDonut data={categoriesYear} /> : <p className="text-sm text-ink-faint">No expenses recorded.</p>}
        </Card>
        <Card>
          <CardHeader title="Net worth · last 12 months" subtitle={`Now ${formatMoney(netWorth.netWorth)}`} />
          <NetWorthChart data={history} height={220} />
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="Monthly summary" />
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="text-left text-xs text-ink-faint">
              <tr>
                <th scope="col" className="py-2 font-medium">Month</th>
                <th scope="col" className="py-2 text-right font-medium">Income</th>
                <th scope="col" className="py-2 text-right font-medium">Expenses</th>
                <th scope="col" className="py-2 text-right font-medium">Net</th>
                <th scope="col" className="py-2 text-right font-medium">Savings rate</th>
              </tr>
            </thead>
            <tbody className="tabular divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.month}>
                  <td className="py-2">{r.label}</td>
                  <td className="py-2 text-right">{formatMoney(r.income)}</td>
                  <td className="py-2 text-right">{formatMoney(r.expenses)}</td>
                  <td className={`py-2 text-right ${r.net < 0 ? 'text-negative' : ''}`}>{formatMoney(r.net)}</td>
                  <td className="py-2 text-right">{r.savingsRate == null ? '—' : `${r.savingsRate}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-ink-faint">Figures are calculated from your recorded transactions. Transfers and adjustments are excluded.</p>
      </Card>
    </>
  )
}
