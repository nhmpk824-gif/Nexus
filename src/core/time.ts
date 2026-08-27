/**
 * Injectable clock for src/core stores.
 *
 * Production uses systemTime(). Tests pass a frozen clock so session ids,
 * cost-entry ids, and auth cooldowns do not depend on wall-clock or Math.random.
 */

export type CoreTime = {
  now: () => number
  /** Stable unique id. `prefix` is included as-is (e.g. `sess-`). */
  id: (prefix: string) => string
}

/**
 * Host clock: Date.now() plus a short random suffix.
 * Id shape matches the historical `${Date.now()}-${random}` tokens.
 */
export function systemTime(): CoreTime {
  return {
    now: () => Date.now(),
    id: (prefix) => `${prefix}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  }
}
