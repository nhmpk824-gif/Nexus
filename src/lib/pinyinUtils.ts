function normalizeLatinText(text: string) {
  return String(text ?? '').trim().toLowerCase()
}

export function toPinyin(text: string) {
  return normalizeLatinText(text)
}

export function toInitials(text: string) {
  return normalizeLatinText(text)
    .split(/\s+/)
    .filter(Boolean)
    .map((chunk) => chunk[0] ?? '')
    .join('')
}

export function matchPinyinFuzzy(input: string, target: string) {
  const normalizedInput = normalizeLatinText(input)
  const normalizedTarget = normalizeLatinText(target)

  return normalizedInput === normalizedTarget
    || normalizedInput.includes(normalizedTarget)
    || normalizedTarget.includes(normalizedInput)
}
