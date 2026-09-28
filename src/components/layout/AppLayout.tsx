import { useState, type FormEvent } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Bell, Search, Settings } from 'lucide-react'
import { useFinance } from '../../data/FinanceDataProvider'
import { cn } from '../../lib/cn'
import { billStatus } from '../../features/bills/billCalc'
import { Notice, Spinner } from '../ui'
import { MAIN_NAV } from './navigation'
import { ThemeToggle } from './ThemeToggle'
import { UserMenu } from './UserMenu'

const iconButton =
  'relative flex size-10 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink'

export function AppLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { loading, error, bills } = useFinance()
  const [query, setQuery] = useState('')
  const due = bills.filter((b) => billStatus(b) === 'overdue' || billStatus(b) === 'due_today').length

  function search(e: FormEvent) {
    e.preventDefault()
    const q = query.trim()
    navigate(q ? `/transactions?q=${encodeURIComponent(q)}` : '/transactions')
  }

  return (
    <div className="min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-accent focus:px-3 focus:py-2 focus:text-black">
        Skip to content
      </a>

      <header className="sticky top-0 z-30 border-b border-line bg-canvas/85 backdrop-blur-md">
        <div className="flex items-center gap-3 px-4 py-3 sm:px-6 lg:px-10">
          <Link to="/" className="flex shrink-0 items-center gap-2.5" aria-label="Finance home">
            <span className="flex size-9 items-center justify-center rounded-full bg-accent text-base font-bold text-black">₱</span>
            <span className="hidden text-lg font-medium tracking-tight sm:block">Finance</span>
          </Link>

          <form role="search" onSubmit={search} className="mx-auto w-full max-w-md">
            <label className="relative block">
              <span className="sr-only">Search transactions</span>
              <Search size={16} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-faint" aria-hidden />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search transactions…"
                className="h-10 w-full rounded-full border border-line bg-surface pr-4 pl-10 text-sm placeholder:text-ink-faint focus:border-accent focus:outline-none"
              />
            </label>
          </form>

          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle />
            <Link to="/bills" className={iconButton} aria-label={due ? `${due} bill${due === 1 ? '' : 's'} need attention` : 'Bills'}>
              <Bell size={16} />
              {due > 0 && <span className="pulse-dot absolute top-2 right-2 size-2 rounded-full bg-accent" aria-hidden />}
            </Link>
            <Link to="/settings" className={cn(iconButton, 'hidden sm:flex')} aria-label="Settings">
              <Settings size={16} />
            </Link>
            <UserMenu />
          </div>
        </div>

        <nav aria-label="Main" className="px-4 pb-3 sm:px-6 lg:px-10">
          <ul className="no-scrollbar flex gap-1 overflow-x-auto">
            {MAIN_NAV.map(({ to, label }) => (
              <li key={to} className="shrink-0">
                <NavLink
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) =>
                    cn(
                      'block rounded-full border px-4 py-1.5 text-sm transition-colors',
                      isActive ? 'border-line-strong bg-surface-2 text-ink' : 'border-transparent text-ink-faint hover:text-ink',
                    )
                  }
                >
                  {to === '/' ? 'Overview' : label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main id="main" className="min-w-0 px-4 py-6 sm:px-6 lg:px-10">
        {error && (
          <div className="mb-4">
            <Notice tone="negative">{error}</Notice>
          </div>
        )}
        {loading ? (
          <Spinner label="Loading your finances" />
        ) : (
          <div key={location.pathname} className="page-enter">
            <Outlet />
          </div>
        )}
      </main>
    </div>
  )
}
