// Debt-free planner: month-by-month payoff simulation + rule-based suggestions.
// Pure functions, integer centavos throughout. Results are calculations, not advice.

export type Strategy = 'avalanche' | 'snowball'

export interface PlanDebt {
  id: string
  name: string
  /** Amount owed today, centavos. */
  balance: number
  /** Annual interest rate in percent (36 = 36%/yr = 3%/month). */
  apr: number
  /** Minimum monthly payment, centavos. */
  minPayment: number
}

export interface PayoffResult {
  feasible: boolean
  /** Why the plan cannot finish, when infeasible. */
  problem?: 'budget_below_minimums' | 'never_pays_off'
  months: number
  totalInterest: number
  totalPaid: number
  /** Debts in the order they are cleared, with the month (1-based) each hits zero. */
  order: Array<{ id: string; name: string; month: number }>
  /** Total remaining balance at the end of each month (index 0 = today). */
  timeline: number[]
}

const MAX_MONTHS = 600

export function totalMinimums(debts: PlanDebt[]): number {
  return debts.reduce((s, d) => s + Math.min(d.minPayment, d.balance), 0)
}

function priority(strategy: Strategy) {
  return strategy === 'avalanche'
    ? (a: { apr: number; bal: number }, b: { apr: number; bal: number }) => b.apr - a.apr || a.bal - b.bal
    : (a: { apr: number; bal: number }, b: { apr: number; bal: number }) => a.bal - b.bal || b.apr - a.apr
}

/**
 * Each month: interest accrues, every debt gets its minimum, and whatever is left of the
 * monthly budget goes to the priority debt (then the next). Freed-up minimums roll over.
 */
export function simulatePayoff(debts: PlanDebt[], monthlyBudget: number, strategy: Strategy): PayoffResult {
  const live = debts.filter((d) => d.balance > 0).map((d) => ({ ...d, bal: d.balance }))
  const result: PayoffResult = { feasible: true, months: 0, totalInterest: 0, totalPaid: 0, order: [], timeline: [live.reduce((s, d) => s + d.bal, 0)] }
  if (!live.length) return result
  if (monthlyBudget < totalMinimums(live)) return { ...result, feasible: false, problem: 'budget_below_minimums' }

  const sortFn = priority(strategy)
  for (let month = 1; month <= MAX_MONTHS; month++) {
    const open = live.filter((d) => d.bal > 0)
    for (const d of open) {
      const interest = Math.round((d.bal * d.apr) / 100 / 12)
      d.bal += interest
      result.totalInterest += interest
    }
    let cash = monthlyBudget
    for (const d of open) {
      const pay = Math.min(d.minPayment, d.bal, cash)
      d.bal -= pay
      cash -= pay
      result.totalPaid += pay
    }
    for (const d of [...open].sort(sortFn)) {
      if (cash <= 0) break
      const pay = Math.min(cash, d.bal)
      d.bal -= pay
      cash -= pay
      result.totalPaid += pay
    }
    for (const d of open) if (d.bal === 0) result.order.push({ id: d.id, name: d.name, month })
    const remaining = live.reduce((s, d) => s + d.bal, 0)
    result.timeline.push(remaining)
    if (remaining === 0) {
      result.months = month
      return result
    }
  }
  return { ...result, feasible: false, problem: 'never_pays_off', months: MAX_MONTHS }
}

export interface PlannerContext {
  debts: PlanDebt[]
  monthlyBudget: number
  strategy: Strategy
  /** Average monthly income / expenses over recent complete months (centavos), when known. */
  avgIncome: number | null
  avgExpenses: number | null
  /** Cash + bank + e-wallet balance. */
  liquid: number
  /** Expense totals for the last 30 days, largest first. */
  topSpending: Array<{ name: string; amount: number }>
  overdueBills: Array<{ name: string; amount: number }>
  /** Credit lines with limit, for utilisation warnings. */
  creditLines: Array<{ name: string; owed: number; limit: number }>
}

export interface Suggestion {
  kind: 'plan' | 'save' | 'boost' | 'warning'
  title: string
  detail: string
  /** Months sooner debt-free, when the suggestion is a what-if. */
  monthsSooner?: number
  interestSaved?: number
}

const peso = (c: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(Math.round(c / 100))

/** Round up to the nearest ₱50 so suggested amounts look human. */
const nice = (c: number) => Math.ceil(c / 5000) * 5000

export function buildSuggestions(ctx: PlannerContext): Suggestion[] {
  const out: Suggestion[] = []
  const base = simulatePayoff(ctx.debts, ctx.monthlyBudget, ctx.strategy)
  const other: Strategy = ctx.strategy === 'avalanche' ? 'snowball' : 'avalanche'
  const alt = simulatePayoff(ctx.debts, ctx.monthlyBudget, other)
  const open = ctx.debts.filter((d) => d.balance > 0)
  if (!open.length) return out

  // 1. Which debt to attack first, and why.
  if (base.feasible && base.order.length) {
    const first = open.find((d) => d.id === base.order[0].id) ?? open[0]
    const target = [...open].sort(
      ctx.strategy === 'avalanche' ? (a, b) => b.apr - a.apr || a.balance - b.balance : (a, b) => a.balance - b.balance || b.apr - a.apr,
    )[0]
    const sameRate = open.every((d) => d.apr === open[0].apr)
    out.push({
      kind: 'plan',
      title: `Put every extra peso on ${target.name}`,
      detail: sameRate && open.length > 1
        ? `All your debts have the same rate (${target.apr}%/yr), so start with the smallest balance, ${target.name} (${peso(target.balance)}). Clearing it frees its minimum payment for the next one.`
        : ctx.strategy === 'avalanche'
          ? `${target.name} has the highest interest (${target.apr}%/yr). Pay the minimum on everything else and send the rest here. ${first.name} is cleared first, in month ${base.order[0].month}.`
          : `${target.name} is your smallest balance (${peso(target.balance)}). Clearing it quickly frees its ${peso(target.minPayment)} minimum for the next debt.`,
    })
    if (alt.feasible && alt.totalInterest < base.totalInterest - 10000) {
      out.push({
        kind: 'plan',
        title: `${other === 'avalanche' ? 'Avalanche' : 'Snowball'} would save ${peso(base.totalInterest - alt.totalInterest)} in interest`,
        detail: `Same monthly payment, different order: debt-free in ${alt.months} months instead of ${base.months}.`,
        interestSaved: base.totalInterest - alt.totalInterest,
      })
    }
  }

  // 2. Problems that block the plan.
  if (!base.feasible && base.problem === 'budget_below_minimums') {
    const gap = totalMinimums(open) - ctx.monthlyBudget
    out.push({
      kind: 'warning',
      title: `Your monthly payment is ${peso(gap)} short of the minimums`,
      detail: `Minimum payments add up to ${peso(totalMinimums(open))}/month. Missing them adds late fees and interest — raise the payment or cut spending below.`,
    })
  } else if (!base.feasible) {
    out.push({
      kind: 'warning',
      title: 'At this payment the balance never goes down',
      detail: 'Interest is eating the whole payment. Increase the monthly amount — even a small raise changes the outcome.',
    })
  }

  // 3. What-if: small monthly boosts.
  const boosts = [50000, 100000, 200000]
  for (const extra of boosts) {
    const s = simulatePayoff(ctx.debts, ctx.monthlyBudget + extra, ctx.strategy)
    if (!s.feasible) continue
    if (!base.feasible) {
      out.push({ kind: 'boost', title: `Pay ${peso(extra)} more per month`, detail: `That makes the plan work: debt-free in ${s.months} months, ${peso(s.totalInterest)} total interest.` })
      break
    }
    const sooner = base.months - s.months
    if (sooner >= 1) {
      out.push({
        kind: 'boost',
        title: `Add ${peso(extra)}/month → debt-free ${sooner} month${sooner === 1 ? '' : 's'} sooner`,
        detail: `Saves about ${peso(base.totalInterest - s.totalInterest)} in interest.`,
        monthsSooner: sooner,
        interestSaved: base.totalInterest - s.totalInterest,
      })
      break
    }
  }

  // 4. Where the extra money can come from: trim the biggest spending categories by 20%.
  for (const cat of ctx.topSpending.slice(0, 3)) {
    const cut = nice(cat.amount * 0.2)
    if (cut < 20000) continue
    const s = simulatePayoff(ctx.debts, ctx.monthlyBudget + cut, ctx.strategy)
    const sooner = base.feasible && s.feasible ? base.months - s.months : 0
    const isSubs = /subscri|streaming|netflix|spotify/i.test(cat.name)
    out.push({
      kind: 'save',
      title: isSubs ? `Review ${cat.name}: cancel what you don't use` : `Trim ${cat.name} by 20% (${peso(cut)}/month)`,
      detail:
        `You spent ${peso(cat.amount)} on ${cat.name} in the last 30 days.` +
        (sooner >= 1 ? ` Redirecting ${peso(cut)}/month to debt makes you debt-free ${sooner} month${sooner === 1 ? '' : 's'} sooner.` : !base.feasible ? ` Redirecting ${peso(cut)}/month helps cover the minimum payments.` : ''),
      monthsSooner: sooner >= 1 ? sooner : undefined,
    })
  }

  // 5. Risk warnings.
  for (const b of ctx.overdueBills.slice(0, 3)) {
    out.push({ kind: 'warning', title: `${b.name} is overdue`, detail: `Pay the ${peso(b.amount)} bill first — late fees and disconnection cost more than interest.` })
  }
  for (const c of ctx.creditLines) {
    if (c.limit > 0 && c.owed / c.limit > 0.3) {
      out.push({
        kind: 'warning',
        title: `${c.name} is ${Math.round((c.owed / c.limit) * 100)}% used`,
        detail: 'Keep credit use under 30% of the limit. Avoid new purchases on it until it is paid down.',
      })
    }
  }
  if (ctx.avgExpenses && ctx.liquid < ctx.avgExpenses) {
    out.push({
      kind: 'warning',
      title: 'Build a small emergency buffer',
      detail: `You have ${peso(ctx.liquid)} in cash/bank vs about ${peso(ctx.avgExpenses)} of monthly spending. Keeping ~${peso(nice(Math.min(ctx.avgExpenses, 1000000)))} aside stops surprise costs from becoming new debt.`,
    })
  }
  if (ctx.avgIncome === null) {
    out.push({
      kind: 'warning',
      title: 'Record your income for better estimates',
      detail: 'No complete month of income is recorded yet, so the monthly payment is based on your minimums only.',
    })
  }
  return out
}

/** Suggested default monthly debt payment: recent average surplus, but never below the minimums. */
export function defaultBudget(debts: PlanDebt[], avgIncome: number | null, avgExpenses: number | null): number {
  const minimums = totalMinimums(debts)
  const surplus = avgIncome !== null && avgExpenses !== null ? avgIncome - avgExpenses : 0
  return Math.max(minimums, nice(surplus))
}

/** Default minimum payment when the lender's isn't known (common PH card rule: 3% or ₱500). */
export function defaultMinimum(type: 'credit_card' | 'loan' | 'debt', owed: number): number {
  if (owed <= 0) return 0
  if (type === 'credit_card') return Math.min(owed, Math.max(Math.round(owed * 0.03), 50000))
  return Math.min(owed, Math.max(Math.ceil(owed / 12), 50000))
}
