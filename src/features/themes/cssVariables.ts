import type { ThemeDefinition } from '../../types/theme'

export function toCssVariables(theme: ThemeDefinition) {
  return {
    '--nexus-surface': theme.tokens.surface,
    '--nexus-surface-muted': theme.tokens.surfaceMuted,
    '--nexus-text-primary': theme.tokens.textPrimary,
    '--nexus-text-muted': theme.tokens.textMuted,
    '--nexus-accent': theme.tokens.accent,
    '--nexus-accent-soft': theme.tokens.accentSoft,
    '--nexus-border': theme.tokens.border,
    '--nexus-shadow': theme.tokens.shadow,
  }
}

export function applyThemeVariables(
  theme: ThemeDefinition,
  target: HTMLElement = document.documentElement,
) {
  const variables = toCssVariables(theme)

  Object.entries(variables).forEach(([name, value]) => {
    target.style.setProperty(name, value)
  })
}
