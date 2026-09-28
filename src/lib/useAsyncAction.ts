import { useState } from 'react'
import { friendlyError } from './firestore'

/** Busy/error state for a form submit; maps errors to safe user-facing messages. */
export function useAsyncAction() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(action: () => Promise<void>, onSuccess?: () => void): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      await action()
      onSuccess?.()
    } catch (err) {
      const known = err instanceof Error && !(err as { code?: string }).code && err.message.length < 120
      setError(known ? err.message : friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  return { busy, error, setError, run }
}
