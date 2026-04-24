/**
 * Time-of-day sunlight — continuous {brightness, saturation, hueRotate}
 * triple across 24 hours. Just dimming a bright daylight scene gives
 * a flat "low exposure" look, not a believable night — real nights
 * also desaturate and cool-shift the palette. Midday noon stays at
 * neutral filter so the scene image reads at its true tones.
 */

export type SunlightState =
  | 'deep_night' | 'late_night' | 'predawn' | 'dawn' | 'sunrise'
  | 'morning' | 'late_morning' | 'noon' | 'afternoon' | 'golden_hour'
  | 'sunset' | 'dusk' | 'early_night' | 'night'

export interface SunlightTone {
  brightness: number // filter brightness(), 1 = neutral
  saturation: number // filter saturate(), 1 = neutral
  hueRotate: number  // filter hue-rotate() in degrees, negative = cooler
}

/**
 * Keyframe table: (hour, tone). Linearly interpolated at runtime.
 * Since SceneBackdrop now ships dedicated day/dusk/night artwork,
 * the filter only needs to fine-tune *within* each band — it's no
 * longer responsible for turning daylight into night. That means
 * gentler brightness/saturation moves across the day and subtle
 * (rather than aggressive) color shifts.
 */
const KEYFRAMES: ReadonlyArray<readonly [hour: number, tone: SunlightTone]> = [
  [0,    { brightness: 0.88, saturation: 0.92, hueRotate: -8 }],  // deep night — slight cool desat
  [4,    { brightness: 0.92, saturation: 0.94, hueRotate: -6 }],
  [5,    { brightness: 0.96, saturation: 1.02, hueRotate: -4 }],  // predawn cool blue
  [6,    { brightness: 1.0,  saturation: 1.08, hueRotate: 4 }],   // dawn — first warm blush
  [7,    { brightness: 1.02, saturation: 1.10, hueRotate: 6 }],   // sunrise warm
  [8,    { brightness: 1.0,  saturation: 1.04, hueRotate: 2 }],
  [10,   { brightness: 1.04, saturation: 1.02, hueRotate: 0 }],
  [12,   { brightness: 1.08, saturation: 1.04, hueRotate: 0 }],   // noon peak — neutral
  [14,   { brightness: 1.06, saturation: 1.03, hueRotate: 0 }],
  [16,   { brightness: 1.02, saturation: 1.06, hueRotate: 4 }],   // afternoon warming
  [17,   { brightness: 1.0,  saturation: 1.12, hueRotate: 10 }],  // golden hour — strong warm
  [18,   { brightness: 0.98, saturation: 1.14, hueRotate: 12 }],  // sunset peak
  [19,   { brightness: 0.95, saturation: 1.06, hueRotate: 6 }],   // dusk fading
  [20,   { brightness: 0.92, saturation: 0.98, hueRotate: -4 }],  // early night cool
  [22,   { brightness: 0.9,  saturation: 0.94, hueRotate: -8 }],
  [24,   { brightness: 0.88, saturation: 0.92, hueRotate: -8 }],
]

export function resolveSunlightTone(date: Date = new Date()): SunlightTone {
  const hours = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600
  return interpolateTone(hours)
}

function interpolateTone(hours: number): SunlightTone {
  if (hours <= KEYFRAMES[0][0]) return KEYFRAMES[0][1]
  if (hours >= KEYFRAMES[KEYFRAMES.length - 1][0]) return KEYFRAMES[KEYFRAMES.length - 1][1]
  for (let i = 0; i < KEYFRAMES.length - 1; i++) {
    const [h0, t0] = KEYFRAMES[i]
    const [h1, t1] = KEYFRAMES[i + 1]
    if (hours >= h0 && hours <= h1) {
      const t = (hours - h0) / (h1 - h0)
      return {
        brightness: lerp(t0.brightness, t1.brightness, t),
        saturation: lerp(t0.saturation, t1.saturation, t),
        hueRotate: lerp(t0.hueRotate, t1.hueRotate, t),
      }
    }
  }
  return { brightness: 1, saturation: 1, hueRotate: 0 }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** Legacy discrete bucketing — still used for CSS class hooks. */
export function resolveSunlightState(date: Date = new Date()): SunlightState {
  const hour = date.getHours() + date.getMinutes() / 60
  if (hour < 2) return 'deep_night'
  if (hour < 4) return 'late_night'
  if (hour < 5) return 'predawn'
  if (hour < 6) return 'dawn'
  if (hour < 8) return 'sunrise'
  if (hour < 10) return 'morning'
  if (hour < 12) return 'late_morning'
  if (hour < 14) return 'noon'
  if (hour < 16) return 'afternoon'
  if (hour < 17) return 'golden_hour'
  if (hour < 18) return 'sunset'
  if (hour < 20) return 'dusk'
  if (hour < 22) return 'early_night'
  return 'deep_night'
}
