import { useEffect, useState } from 'react'
import { onSnapshot, orderBy, query, type QueryConstraint } from 'firebase/firestore'
import { fromFirestore, userCol, type UserCollection } from '../lib/firestore'

export interface CollectionState<T> {
  data: T[]
  loading: boolean
  error: string | null
}

/**
 * Live subscription to users/{uid}/{name}. Queries are always scoped to the signed-in
 * user's own path — rules are not filters, so we never query broader collections.
 */
export function useUserCollection<T>(
  uid: string | undefined,
  name: UserCollection,
  order?: { field: string; direction?: 'asc' | 'desc' },
  enabled = true,
): CollectionState<T> {
  const [state, setState] = useState<CollectionState<T>>({ data: [], loading: true, error: null })
  const orderField = order?.field
  const orderDirection = order?.direction

  useEffect(() => {
    if (!uid || !enabled) {
      setState({ data: [], loading: false, error: null })
      return
    }
    setState((s) => ({ ...s, loading: true }))
    const constraints: QueryConstraint[] = orderField ? [orderBy(orderField, orderDirection ?? 'asc')] : []
    return onSnapshot(
      query(userCol(uid, name), ...constraints),
      (snap) => {
        setState({
          data: snap.docs.map((d) => fromFirestore<T>(d.id, d.data({ serverTimestamps: 'estimate' }))),
          loading: false,
          error: null,
        })
      },
      (err) => {
        if (import.meta.env.DEV) console.error(`[${name}]`, err)
        setState({ data: [], loading: false, error: 'Could not load your data.' })
      },
    )
  }, [uid, name, orderField, orderDirection, enabled])

  return state
}
