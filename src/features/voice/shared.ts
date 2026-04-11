export function formatTraceLabel(traceId: string) {
  return traceId.slice(-6).toUpperCase()
}

export function logVoiceEvent(message: string, details?: Record<string, unknown>) {
  if (details) {
    console.info(`[Voice] ${message}`, details)
    return
  }

  console.info(`[Voice] ${message}`)
}
