function normalizeWeatherText(text: string) {
  return String(text ?? '').replace(/\s+/g, ' ').trim()
}

export function stripWeatherPeriodPrefix(summary: string, label: string) {
  const normalizedSummary = normalizeWeatherText(summary)
  const normalizedLabel = normalizeWeatherText(label)

  if (!normalizedSummary || !normalizedLabel) {
    return normalizedSummary
  }

  const escapedLabel = normalizedLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return normalizeWeatherText(
    normalizedSummary.replace(new RegExp(`^${escapedLabel}[，,、:：\\s]*`, 'u'), ''),
  )
}

export function formatWeatherPeriodSummary(label: string, summary: string) {
  const normalizedLabel = normalizeWeatherText(label)
  const strippedSummary = stripWeatherPeriodPrefix(summary, normalizedLabel)

  if (!normalizedLabel) {
    return strippedSummary
  }

  if (!strippedSummary) {
    return normalizedLabel
  }

  return `${normalizedLabel}，${strippedSummary}`
}
