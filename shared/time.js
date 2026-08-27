/**
 * Cross-process clock helpers. Renderer (`src/lib/localDate.ts`) and
 * Electron (`electron/services/localDataStoreCore.js`) must share one
 * nowIso implementation so ISO stamps cannot drift.
 */

/**
 * ISO-8601 timestamp for the given moment (defaults to now).
 * @param {Date | string | number} [now]
 */
export function nowIso(now = new Date()) {
  return now instanceof Date ? now.toISOString() : new Date(now).toISOString()
}
