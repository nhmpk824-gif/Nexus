import { trackWithConsent } from '../../features/analytics/index.ts'
import { ensureLocaleLoaded, normalizeLocale, setLocale } from '../../i18n/runtime.ts'
import { getCoreRuntime } from '../../lib/coreRuntime.ts'
import { getSettingsSnapshot } from '../store/settingsStore.ts'

let initPromise: Promise<void> | null = null

export async function initApp() {
  if (!initPromise) {
    initPromise = Promise.resolve().then(async () => {
      // Restore auth/budget stores before the first chat or settings paint.
      getCoreRuntime()

      const startupLocale = normalizeLocale(getSettingsSnapshot().uiLanguage)
      await ensureLocaleLoaded(startupLocale)
      setLocale(startupLocale)

      await trackWithConsent('app.bootstrap', {
        source: 'initApp',
      })
    })
  }

  return initPromise
}
