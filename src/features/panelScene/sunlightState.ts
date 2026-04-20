/**
 * 14-state sunlight tint — one "mood" per ~1.7 hours of the day. Maps the
 * clock to a named state, each tied to a CSS class that defines a palette
 * of tint + highlight + rim-light colors on the scene backdrop. States
 * transition smoothly because all CSS color properties use transition.
 */

export type SunlightState =
  | 'deep_night'        // 22 - 02
  | 'late_night'        // 02 - 04
  | 'predawn'           // 04 - 05
  | 'dawn'              // 05 - 06
  | 'sunrise'           // 06 - 08
  | 'morning'           // 08 - 10
  | 'late_morning'      // 10 - 12
  | 'noon'              // 12 - 14
  | 'afternoon'         // 14 - 16
  | 'golden_hour'       // 16 - 17
  | 'sunset'            // 17 - 18
  | 'dusk'              // 18 - 20
  | 'early_night'       // 20 - 22
  | 'night'             // standalone — not used by time bucketing but available
                        // if a scene needs a distinct moonlit variant

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
