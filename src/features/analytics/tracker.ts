import { getAnalyticsSessionId } from './session'
import { consoleSink } from './sinks/consoleSink'
import type { AnalyticsEvent, AnalyticsEventName, AnalyticsSink } from '../../types/analytics'

export function createTracker(sinks: AnalyticsSink[] = [consoleSink]) {
  return async function trackEvent(name: AnalyticsEventName, payload?: Record<string, unknown>) {
    const event: AnalyticsEvent = {
      name,
      payload,
      timestamp: new Date().toISOString(),
      sessionId: getAnalyticsSessionId(),
    }

    await Promise.allSettled(sinks.map((sink) => Promise.resolve(sink(event))))
  }
}

export const track = createTracker()
