import type { AnalyticsSink } from '../../../types/analytics'

export const consoleSink: AnalyticsSink = async (event) => {
  console.debug('[analytics]', event.name, event.payload ?? {})
}
