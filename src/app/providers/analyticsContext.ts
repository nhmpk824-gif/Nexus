import { createContext } from 'react'
import type { AnalyticsContextValue } from '../../types/analytics'

export const AnalyticsContext = createContext<AnalyticsContextValue | null>(null)
