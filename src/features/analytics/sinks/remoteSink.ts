import type { AnalyticsSink } from '../../../types/analytics'

export function createRemoteSink(endpoint: string): AnalyticsSink {
  return async (event) => {
    if (!endpoint) {
      return
    }

    await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    })
  }
}
