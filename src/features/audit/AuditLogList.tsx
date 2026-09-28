import { useEffect, useState } from 'react'
import { limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import { Badge } from '../../components/ui'
import { formatDateTime } from '../../lib/dates'
import { fromFirestore, userCol } from '../../lib/firestore'
import type { AuditLog } from './types'

function tone(action: string) {
  if (action.startsWith('auth.login_failed')) return 'negative' as const
  if (action.startsWith('auth.')) return 'accent' as const
  if (action.endsWith('.deleted')) return 'warning' as const
  return 'neutral' as const
}

/** Read-only, append-only activity history (rules forbid edits and deletes). */
export function AuditLogList({ uid, max = 50 }: { uid: string; max?: number }) {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    return onSnapshot(
      query(userCol(uid, 'auditLogs'), orderBy('createdAt', 'desc'), limit(max)),
      (snap) => {
        setLogs(snap.docs.map((d) => fromFirestore<AuditLog>(d.id, d.data({ serverTimestamps: 'estimate' }))))
        setLoaded(true)
      },
      () => setLoaded(true),
    )
  }, [uid, max])

  if (!loaded) return <p className="text-sm text-ink-faint">Loading activity…</p>
  if (!logs.length) return <p className="text-sm text-ink-faint">No activity yet.</p>

  return (
    <ul className="divide-y divide-line">
      {logs.map((l) => (
        <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
          <div className="flex min-w-0 items-center gap-3">
            <Badge tone={tone(l.action)}>{l.action}</Badge>
            {l.details && <span className="truncate text-ink-muted">{l.details}</span>}
          </div>
          <time className="shrink-0 text-xs text-ink-faint" dateTime={l.createdAt?.toISOString()}>
            {formatDateTime(l.createdAt)}
          </time>
        </li>
      ))}
    </ul>
  )
}
