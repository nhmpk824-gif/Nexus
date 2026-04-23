/**
 * Pure helpers for mcpHost. Extracted so unit tests can import them
 * without dragging Electron's app/dialog surface into node:test.
 */

/**
 * Parse a free-form args string from the settings UI into an argv array.
 * Supports quoted args with embedded spaces: `--root "F:\my data"` → ['--root', 'F:\\my data'].
 * Lines are joined first so a user can freely use newlines in the textarea.
 */
export function parseArgsString(raw) {
  if (!raw) return []
  const flat = String(raw).replace(/\r?\n/g, ' ').trim()
  if (!flat) return []

  const out = []
  let current = ''
  let quote = null
  for (const ch of flat) {
    if (quote) {
      if (ch === quote) {
        quote = null
      } else {
        current += ch
      }
      continue
    }
    if (ch === '"' || ch === '\'') {
      quote = ch
      continue
    }
    if (ch === ' ' || ch === '\t') {
      if (current) {
        out.push(current)
        current = ''
      }
      continue
    }
    current += ch
  }
  if (current) out.push(current)
  return out
}
