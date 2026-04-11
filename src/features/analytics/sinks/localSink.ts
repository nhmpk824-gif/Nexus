import type { AnalyticsEvent, AnalyticsSink } from '../../../types/analytics'

const ANALYTICS_EVENTS_STORAGE_KEY = 'nexus:analytics:events'
const MAX_STORED_EVENTS = 50

function readStoredEvents() {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const raw = window.localStorage.getItem(ANALYTICS_EVENTS_STORAGE_KEY)
    if (!raw) {
      return []
    }

    return JSON.parse(raw) as AnalyticsEvent[]
  } catch {
    return []
  }
}

export const localSink: AnalyticsSink = async (event) => {
  if (typeof window === 'undefined') {
    return
  }

  const nextEvents = [...readStoredEvents(), event].slice(-MAX_STORED_EVENTS)
  window.localStorage.setItem(ANALYTICS_EVENTS_STORAGE_KEY, JSON.stringify(nextEvents))
}
