import { defaultThemeTokens } from '../tokens'
import type { ThemeDefinition } from '../../../types/theme'

export const highContrastTheme: ThemeDefinition = {
  id: 'high-contrast',
  name: 'High Contrast',
  description: 'Accessibility-oriented theme with stronger contrast and borders.',
  tokens: {
    ...defaultThemeTokens,
    surface: '#ffffff',
    surfaceMuted: '#f0f0f0',
    textPrimary: '#000000',
    textMuted: '#222222',
    border: '#000000',
    shadow: 'rgba(0, 0, 0, 0.18)',
  },
}
