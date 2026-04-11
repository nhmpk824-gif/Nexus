export function normalizePunctuation(text: string) {
  return text.replace(/[！]/g, '!').replace(/[？]/g, '?').replace(/[，]/g, ',')
}

export function normalizeFullHalfWidth(text: string) {
  return text.normalize('NFKC')
}

export function normalizeChineseText(text: string) {
  return normalizePunctuation(normalizeFullHalfWidth(text)).trim()
}
