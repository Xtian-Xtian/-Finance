import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { computeBalances } from '../features/accounts/accountCalc'
import type { Account } from '../features/accounts/types'
import { useAuth } from '../features/auth/AuthProvider'
import type { Bill } from '../features/bills/types'
import type { Budget } from '../features/budgets/types'
import type { Category } from '../features/categories/types'
import type { Debt } from '../features/debts/types'
import type { FinancialGoal } from '../features/goals/types'
import type { Investment, InvestmentTransaction } from '../features/investments/types'
import { netWorthBreakdown } from '../features/networth/netWorthCalc'
import type { NetWorthBreakdown, NetWorthSnapshot } from '../features/networth/types'
import type { SavingsGoal } from '../features/savings/types'
import type { Transaction } from '../features/transactions/types'
import { useUserCollection } from './useUserCollection'

export interface FinanceData {
  uid: string
  loading: boolean
  error: string | null
  accounts: Account[]
  transactions: Transaction[]
  categories: Category[]
  budgets: Budget[]
  savingsGoals: SavingsGoal[]
  bills: Bill[]
  debts: Debt[]
  investments: Investment[]
  investmentTransactions: InvestmentTransaction[]
  financialGoals: FinancialGoal[]
  snapshots: NetWorthSnapshot[]
  /** Derived: accountId -> current balance (centavos). */
  balances: Map<string, number>
  netWorth: NetWorthBreakdown
}

/** Exported for previews/tests that need to supply data without Firestore. */
// eslint-disable-next-line react-refresh/only-export-components
export const FinanceDataContext = createContext<FinanceData | null>(null)

/** Single place that subscribes to the signed-in user's financial collections. */
export function FinanceDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const uid = user?.uid

  const accounts = useUserCollection<Account>(uid, 'accounts', { field: 'name' })
  const transactions = useUserCollection<Transaction>(uid, 'transactions', { field: 'date', direction: 'desc' })
  const categories = useUserCollection<Category>(uid, 'categories', { field: 'name' })
  const budgets = useUserCollection<Budget>(uid, 'budgets')
  const savingsGoals = useUserCollection<SavingsGoal>(uid, 'savingsGoals', { field: 'createdAt' })
  const bills = useUserCollection<Bill>(uid, 'bills', { field: 'dueDate' })
  const debts = useUserCollection<Debt>(uid, 'debts', { field: 'createdAt' })
  const investments = useUserCollection<Investment>(uid, 'investments', { field: 'createdAt' })
  const investmentTransactions = useUserCollection<InvestmentTransaction>(uid, 'investmentTransactions', { field: 'date', direction: 'desc' })
  const financialGoals = useUserCollection<FinancialGoal>(uid, 'financialGoals', { field: 'createdAt' })
  const snapshots = useUserCollection<NetWorthSnapshot>(uid, 'netWorthSnapshots')

  const all = [accounts, transactions, categories, budgets, savingsGoals, bills, debts, investments, investmentTransactions, financialGoals, snapshots]
  const loading = all.some((s) => s.loading)
  const error = all.find((s) => s.error)?.error ?? null

  const balances = useMemo(() => computeBalances(accounts.data, transactions.data), [accounts.data, transactions.data])
  const netWorth = useMemo(
    () => netWorthBreakdown(accounts.data, balances, investments.data, debts.data),
    [accounts.data, balances, investments.data, debts.data],
  )

  const value: FinanceData = {
    uid: uid ?? '',
    loading,
    error,
    accounts: accounts.data,
    transactions: transactions.data,
    categories: categories.data,
    budgets: budgets.data,
    savingsGoals: savingsGoals.data,
    bills: bills.data,
    debts: debts.data,
    investments: investments.data,
    investmentTransactions: investmentTransactions.data,
    financialGoals: financialGoals.data,
    snapshots: snapshots.data,
    balances,
    netWorth,
  }

  return <FinanceDataContext.Provider value={value}>{children}</FinanceDataContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useFinance(): FinanceData {
  const ctx = useContext(FinanceDataContext)
  if (!ctx) throw new Error('useFinance must be used inside FinanceDataProvider')
  return ctx
}
