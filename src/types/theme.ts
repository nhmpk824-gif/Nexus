export type ThemeId = 'nexus-default' | 'soft' | 'high-contrast' | 'editorial'

export interface ThemeTokens {
  surface: string
  surfaceMuted: string
  textPrimary: string
  textMuted: string
  accent: string
  accentSoft: string
  border: string
  shadow: string
}

export interface ThemeDefinition {
  id: ThemeId
  name: string
  description: string
  tokens: ThemeTokens
}

export interface ThemeContextValue {
  themeId: ThemeId
  setTheme: (themeId: ThemeId) => void
  theme: ThemeDefinition
  availableThemes: ThemeDefinition[]
}
