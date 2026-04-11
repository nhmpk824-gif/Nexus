import { useEffect, type ReactNode } from 'react'
import { initApp } from '../bootstrap'
import { AnalyticsProvider } from './AnalyticsProvider'
import { I18nProvider } from './I18nProvider'
import { ThemeProvider } from './ThemeProvider'

type AppProvidersProps = {
  children: ReactNode
}

export function AppProviders({ children }: AppProvidersProps) {
  useEffect(() => {
    void initApp()
  }, [])

  return (
    <AnalyticsProvider>
      <ThemeProvider>
        <I18nProvider>{children}</I18nProvider>
      </ThemeProvider>
    </AnalyticsProvider>
  )
}
