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
  'auto',
  'deep_night', 'late_night', 'predawn',
  'dawn', 'sunrise', 'morning', 'late_morning',
  'noon', 'afternoon', 'golden_hour',
  'sunset', 'dusk', 'early_night', 'night',
] as const

export function normalizePetTimePreview(raw: unknown): PetTimePreview {
  if (typeof raw === 'string' && (PET_TIME_PREVIEWS as readonly string[]).includes(raw)) {
    return raw as PetTimePreview
  }
  return 'auto'
}

/**
 * Canonical hour-of-day (decimal) used when a PetTimePreview pins a
 * specific sunlight state. Feeds `resolveSunlightTone(date)` so the
 * filter looks like the real time even though the clock says otherwise.
 */
export const PET_TIME_PREVIEW_HOURS: Record<Exclude<PetTimePreview, 'auto'>, number> = {
  deep_night:   2,
  late_night:   3,
  predawn:      4.5,
  dawn:         5.5,
  sunrise:      7,
  morning:      9,
  late_morning: 11,
  noon:         12,
  afternoon:    14.5,
  golden_hour:  16.5,
  sunset:       17.5,
  dusk:         19,
  early_night:  21,
  night:        23,
}

/**
 * Which of the 3 bundled scene images (day / dusk / night) to show
 * for a given preview state. Morning-through-afternoon read as "day";
 * dawn / sunset / golden-hour / dusk read as "dusk"; everything past
 * bedtime reads as "night".
 */
export const PET_TIME_PREVIEW_BANDS: Record<Exclude<PetTimePreview, 'auto'>, 'day' | 'dusk' | 'night'> = {
  deep_night:   'night',
  late_night:   'night',
  predawn:      'night',
  dawn:         'dusk',
  sunrise:      'dusk',
  morning:      'day',
  late_morning: 'day',
  noon:         'day',
  afternoon:    'day',
  golden_hour:  'dusk',
  sunset:       'dusk',
  dusk:         'dusk',
  early_night:  'night',
  night:        'night',
}
