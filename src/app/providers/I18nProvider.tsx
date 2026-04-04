import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { getAnalyticsConsent, track } from '../../features/analytics'
import {
  AVAILABLE_LOCALES,
  I18nContext,
  normalizeLocale,
  setLocale as setGlobalLocale,
  t,
} from '../../i18n'
import { getSettingsSnapshot, subscribeToSettings } from '../store/settingsStore'
import type { AppLocale, I18nContextValue } from '../../types/i18n'

type I18nProviderProps = {
  children: ReactNode
}

export function I18nProvider({ children }: I18nProviderProps) {
  const localeHydratedRef = useRef(false)
  const [locale, setLocaleState] = useState<AppLocale>(() => {
    const normalizedLocale = normalizeLocale(getSettingsSnapshot().uiLanguage)
    setGlobalLocale(normalizedLocale)
    return normalizedLocale
  })

  useEffect(() => {
    setGlobalLocale(locale)

    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale
    }
  }, [locale])

  useEffect(() => {
    if (!localeHydratedRef.current) {
      localeHydratedRef.current = true
      return
    }

    if (!getAnalyticsConsent()) {
      return
    }

    void track('settings.locale_changed', {
      locale,
    })
  }, [locale])

  useEffect(() => {
    return subscribeToSettings((settings) => {
      const nextLocale = normalizeLocale(settings.uiLanguage)
      setGlobalLocale(nextLocale)
      setLocaleState((currentLocale) => (
        currentLocale === nextLocale ? currentLocale : nextLocale
      ))
    })
  }, [])

  const value = useMemo<I18nContextValue>(() => ({
    locale,
    setLocale: (nextLocale) => {
      const normalizedLocale = normalizeLocale(nextLocale)
      setGlobalLocale(normalizedLocale)
      setLocaleState(normalizedLocale)
    },
    t: (key, params) => t(key, params, locale),
    availableLocales: AVAILABLE_LOCALES,
  }), [locale])

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  )
}
