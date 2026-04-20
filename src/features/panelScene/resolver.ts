/**
 * Pet stage configuration resolvers.
 *
 * The historic panel-scene backdrop (a CSS gradient for the chat panel)
 * was removed in favor of the 3-layer pet backdrop: a bundled anime-style
 * SceneBackdrop image, an animated WeatherAmbient layer, and a continuous
 * SunlightTint filter. This module carries the normalizers that turn
 * stored (possibly stale) settings values into typed enums.
 */

import type { PetSceneLocation, PetTimePreview, PetWeatherPreview } from '../../types'

export const PET_SCENE_LOCATIONS: readonly PetSceneLocation[] = [
  'off', 'city', 'countryside', 'seaside', 'fields', 'mountain',
] as const

export function normalizePetSceneLocation(raw: unknown): PetSceneLocation {
  if (typeof raw === 'string' && (PET_SCENE_LOCATIONS as readonly string[]).includes(raw)) {
    return raw as PetSceneLocation
  }
  return 'off'
}

export const PET_WEATHER_PREVIEWS: readonly PetWeatherPreview[] = [
  'auto',
  'clear', 'partly_cloudy', 'overcast',
  'drizzle', 'rain', 'heavy_rain',
  'thunder', 'storm',
  'light_snow', 'snow', 'heavy_snow',
  'fog',
  'breeze', 'gale',
] as const

export function normalizePetWeatherPreview(raw: unknown): PetWeatherPreview {
  if (typeof raw === 'string' && (PET_WEATHER_PREVIEWS as readonly string[]).includes(raw)) {
    return raw as PetWeatherPreview
  }
  return 'auto'
}

export const PET_TIME_PREVIEWS: readonly PetTimePreview[] = [
  'auto', 'day', 'dusk', 'night',
] as const

export function normalizePetTimePreview(raw: unknown): PetTimePreview {
  if (typeof raw === 'string' && (PET_TIME_PREVIEWS as readonly string[]).includes(raw)) {
    return raw as PetTimePreview
  }
  return 'auto'
}
