import {
  ArrowLeftRight,
  BarChart3,
  CalendarClock,
  Flag,
  HandCoins,
  LayoutDashboard,
  PiggyBank,
  Settings,
  ShieldCheck,
  TrendingUp,
  Wallet,
  WalletCards,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

export const MAIN_NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { to: '/accounts', label: 'Accounts', icon: WalletCards },
  { to: '/budgets', label: 'Budgets', icon: Wallet },
  { to: '/savings', label: 'Savings', icon: PiggyBank },
  { to: '/bills', label: 'Bills', icon: CalendarClock },
  { to: '/debts', label: 'Debts', icon: HandCoins },
  { to: '/investments', label: 'Investments', icon: TrendingUp },
  { to: '/goals', label: 'Goals', icon: Flag },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
]

export const SECONDARY_NAV: NavItem[] = [
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/security', label: 'Security', icon: ShieldCheck },
]
