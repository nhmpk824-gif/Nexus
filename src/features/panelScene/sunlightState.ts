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
 * Keyframe table: (hour, tone). Linearly interpolated at runtime. Keep
 * hueRotate magnitude small — CSS hue-rotate shifts all hues uniformly,
 * so ±12deg is about the max before greens turn weird blue. Warmth at
 * golden hour comes more from saturation bump than hue-rotate.
 */
const KEYFRAMES: ReadonlyArray<readonly [hour: number, tone: SunlightTone]> = [
  [0,     { brightness: 0.3,  saturation: 0.45, hueRotate: -12 }],
  [2,     { brightness: 0.3,  saturation: 0.45, hueRotate: -12 }],
  [4,     { brightness: 0.4,  saturation: 0.55, hueRotate: -10 }],
  [5,     { brightness: 0.52, saturation: 0.7,  hueRotate: -6 }],
  [5.75,  { brightness: 0.68, saturation: 0.85, hueRotate: 0 }],
  [6.5,   { brightness: 0.8,  saturation: 0.95, hueRotate: 3 }],
  [7.25,  { brightness: 0.9,  saturation: 1.0,  hueRotate: 2 }],
  [8,     { brightness: 0.96, saturation: 1.0,  hueRotate: 1 }],
  [9,     { brightness: 0.99, saturation: 1.0,  hueRotate: 0 }],
  [10,    { brightness: 1.02, saturation: 1.0,  hueRotate: 0 }],
  [11,    { brightness: 1.05, saturation: 1.02, hueRotate: 0 }],
  [12,    { brightness: 1.08, saturation: 1.03, hueRotate: 0 }],
  [13,    { brightness: 1.07, saturation: 1.03, hueRotate: 0 }],
  [14,    { brightness: 1.05, saturation: 1.02, hueRotate: 0 }],
  [15,    { brightness: 1.02, saturation: 1.0,  hueRotate: 1 }],
  [16,    { brightness: 0.98, saturation: 1.02, hueRotate: 3 }],
  [16.75, { brightness: 0.92, saturation: 1.08, hueRotate: 6 }],
  [17.25, { brightness: 0.85, saturation: 1.1,  hueRotate: 8 }],
  [17.75, { brightness: 0.76, saturation: 1.05, hueRotate: 5 }],
  [18.25, { brightness: 0.66, saturation: 0.98, hueRotate: 2 }],
  [18.75, { brightness: 0.56, saturation: 0.88, hueRotate: -2 }],
  [19.5,  { brightness: 0.46, saturation: 0.72, hueRotate: -6 }],
  [20.5,  { brightness: 0.38, saturation: 0.58, hueRotate: -9 }],
  [21.5,  { brightness: 0.33, saturation: 0.5,  hueRotate: -11 }],
  [22.5,  { brightness: 0.3,  saturation: 0.45, hueRotate: -12 }],
  [24,    { brightness: 0.3,  saturation: 0.45, hueRotate: -12 }],
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
