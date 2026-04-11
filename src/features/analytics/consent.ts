const ANALYTICS_CONSENT_STORAGE_KEY = 'nexus:analytics:consent'

export function getAnalyticsConsent() {
  if (typeof window === 'undefined') {
    return false
  }

  return window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY) === 'granted'
}

export function setAnalyticsConsent(granted: boolean) {
  if (typeof window === 'undefined') {
    return
  }

  if (granted) {
    window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, 'granted')
    return
  }

  window.localStorage.removeItem(ANALYTICS_CONSENT_STORAGE_KEY)
}
