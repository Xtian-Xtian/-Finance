import { useTheme } from '../../app/ThemeProvider'

// Shared chart styling so every chart reads as one system. SVG attributes can't read CSS
// variables reliably, so charts pick their palette from the current theme via useChartTheme().
const DARK = {
  income: '#c8f542',
  expenses: '#7c6cf6',
  savings: '#5eead4',
  netWorth: '#c8f542',
  grid: '#1e1e27',
  axis: '#71717a',
  /** Neutral bar colour (non-highlighted bars). */
  muted: '#23232d',
}

const LIGHT: typeof DARK = {
  income: '#65a30d',
  expenses: '#6d5dfc',
  savings: '#0d9488',
  netWorth: '#65a30d',
  grid: '#e4e6eb',
  axis: '#767b88',
  muted: '#e4e6eb',
}

export type ChartTheme = typeof DARK

export function useChartTheme(): ChartTheme {
  return useTheme().resolved === 'light' ? LIGHT : DARK
}

/** Axis defaults; stroke adapts via the current theme's axis colour. */
export function axisPropsFor(chart: ChartTheme) {
  return { stroke: chart.axis, fontSize: 11, tickLine: false, axisLine: false } as const
}
