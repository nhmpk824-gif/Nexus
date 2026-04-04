import { track } from '../../features/analytics'

let initPromise: Promise<void> | null = null

export async function initApp() {
  if (!initPromise) {
    initPromise = Promise.resolve().then(async () => {
      await track('app.bootstrap', {
        source: 'initApp',
      })
    })
  }

  return initPromise
}
