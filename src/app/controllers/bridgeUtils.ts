// Parse a comma-separated string of IDs (chatIds/userIds) into a Set of
// trimmed non-empty strings. Used to match bridge senders against the
// owner whitelist, so the system prompt can treat the master's own
// Telegram/Discord messages as coming from the master rather than an
// external contact.
export function parseCsvIdSet(csv: string): Set<string> {
  const result = new Set<string>()
  for (const raw of csv.split(',')) {
    const trimmed = raw.trim()
    if (trimmed) result.add(trimmed)
  }
  return result
}
