let analyticsSessionId = ''

export function getAnalyticsSessionId() {
  if (!analyticsSessionId) {
    analyticsSessionId = crypto.randomUUID()
  }

  return analyticsSessionId
}

export function resetAnalyticsSession() {
  analyticsSessionId = ''
}
