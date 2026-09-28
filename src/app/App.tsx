import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from '../components/layout/AppLayout'
import { Spinner } from '../components/ui'
import { FinanceDataProvider } from '../data/FinanceDataProvider'
import { AuthProvider } from '../features/auth/AuthProvider'
import { ThemeProvider } from './ThemeProvider'
import { LoginPage } from '../features/auth/LoginPage'
import { RegisterPage } from '../features/auth/RegisterPage'
import { ResetPasswordPage } from '../features/auth/ResetPasswordPage'
import { VerifyEmailPage } from '../features/auth/VerifyEmailPage'
import { PublicOnly, RequireAuth, RequireUnverified } from './guards'

// Feature pages are code-split so each loads on demand.
const page = <T extends Record<string, React.ComponentType>>(loader: () => Promise<T>, name: keyof T) =>
  lazy(() => loader().then((m) => ({ default: m[name] })))

const DashboardPage = page(() => import('../features/dashboard/DashboardPage'), 'DashboardPage')
const TransactionsPage = page(() => import('../features/transactions/TransactionsPage'), 'TransactionsPage')
const AccountsPage = page(() => import('../features/accounts/AccountsPage'), 'AccountsPage')
const BudgetsPage = page(() => import('../features/budgets/BudgetsPage'), 'BudgetsPage')
const SavingsPage = page(() => import('../features/savings/SavingsPage'), 'SavingsPage')
const BillsPage = page(() => import('../features/bills/BillsPage'), 'BillsPage')
const DebtsPage = page(() => import('../features/debts/DebtsPage'), 'DebtsPage')
const InvestmentsPage = page(() => import('../features/investments/InvestmentsPage'), 'InvestmentsPage')
const GoalsPage = page(() => import('../features/goals/GoalsPage'), 'GoalsPage')
const ReportsPage = page(() => import('../features/reports/ReportsPage'), 'ReportsPage')
const SettingsPage = page(() => import('../features/settings/SettingsPage'), 'SettingsPage')
const SecurityPage = page(() => import('../features/settings/SecurityPage'), 'SecurityPage')

export function App() {
  return (
    <ThemeProvider>
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<Spinner />}>
          <Routes>
            <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
            <Route path="/register" element={<PublicOnly><RegisterPage /></PublicOnly>} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/verify-email" element={<RequireUnverified><VerifyEmailPage /></RequireUnverified>} />
            <Route
              element={
                <RequireAuth>
                  <FinanceDataProvider>
                    <AppLayout />
                  </FinanceDataProvider>
                </RequireAuth>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="transactions" element={<TransactionsPage />} />
              <Route path="accounts" element={<AccountsPage />} />
              <Route path="budgets" element={<BudgetsPage />} />
              <Route path="savings" element={<SavingsPage />} />
              <Route path="bills" element={<BillsPage />} />
              <Route path="debts" element={<DebtsPage />} />
              <Route path="investments" element={<InvestmentsPage />} />
              <Route path="goals" element={<GoalsPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="security" element={<SecurityPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
    </ThemeProvider>
  )
}
