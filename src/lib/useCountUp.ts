import { useEffect, useRef, useState } from 'react'

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/**
 * Animates a number from its previous value (0 on first render) to `target` with an
 * ease-out curve. Returns integers, so it is safe for centavos. Respects reduced motion.
 */
export function useCountUp(target: number, durationMs = 900): number {
  const reduced = prefersReducedMotion()
  const [value, setValue] = useState(() => (reduced ? target : 0))
  const fromRef = useRef(value)

  useEffect(() => {
    if (reduced) {
      fromRef.current = target
      return
    }
    const from = fromRef.current
    if (from === target) return
    let frame = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      const eased = 1 - Math.pow(1 - t, 3)
      const next = Math.round(from + (target - from) * eased)
      setValue(next)
      fromRef.current = next
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, durationMs, reduced])

  return reduced ? target : value
}
