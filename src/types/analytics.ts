export type AnalyticsEventName =
  | 'app.bootstrap'
  | 'app.provider_ready'
  | 'settings.locale_changed'
  | 'settings.theme_changed'

export interface AnalyticsEvent {
  name: AnalyticsEventName
  payload?: Record<string, unknown>
  timestamp: string
  sessionId: string
}

export type AnalyticsSink = (event: AnalyticsEvent) => void | Promise<void>

export interface AnalyticsContextValue {
  enabled: boolean
  track: (name: AnalyticsEventName, payload?: Record<string, unknown>) => Promise<void>
}
