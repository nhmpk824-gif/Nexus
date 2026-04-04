import { softTheme } from './presets/soft'
import { editorialTheme } from './presets/editorial'
import { highContrastTheme } from './presets/high-contrast'
import { nexusDefaultTheme } from './presets/nexus-default'
import type { ThemeDefinition, ThemeId } from '../../types/theme'

const themeMap: Record<ThemeId, ThemeDefinition> = {
  'nexus-default': nexusDefaultTheme,
  soft: softTheme,
  'high-contrast': highContrastTheme,
  editorial: editorialTheme,
}

export const themeRegistry = Object.values(themeMap)

export function listThemes() {
  return themeRegistry
}

export function getTheme(themeId: ThemeId) {
  return themeMap[themeId] ?? null
}

export function resolveTheme(themeId: ThemeId) {
  return getTheme(themeId) ?? nexusDefaultTheme
}
