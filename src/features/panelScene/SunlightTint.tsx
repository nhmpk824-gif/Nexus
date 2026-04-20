import { useEffect, useState } from 'react'
import type { ReactNode, CSSProperties } from 'react'
import type { PetTimePreview } from '../../types'
import { resolveSunlightTone, resolveSunlightState, type SunlightState, type SunlightTone } from './sunlightState.ts'

type SunlightTintProps = {
  children?: ReactNode
  /** Re-check the clock this often (ms). 60s keeps the filter glide
   * smooth across the day without hammering state. The CSS transition
   * on `filter` absorbs the step between readings so no abrupt jumps. */
  refreshIntervalMs?: number
  /** When set to a specific band, lock the filter to that time of day
   * (canonical hour of the band). 'auto' uses the real clock. */
  timePreview?: PetTimePreview
}

/** Canonical hours used when timePreview pins a band. Matches the
 * midpoint of each SunlightTone keyframe band so the preview looks
 * like the typical feel of that time. */
const PREVIEW_HOUR: Record<Exclude<PetTimePreview, 'auto'>, number> = {
  day: 12,
  dusk: 18.5,
  night: 22,
}

function dateAtHour(hoursDecimal: number): Date {
  const d = new Date()
  d.setHours(Math.floor(hoursDecimal), Math.round((hoursDecimal % 1) * 60), 0, 0)
  return d
}

/**
 * Time-of-day layer. Applies a CSS `filter` chain to the whole scene
 * stack (backdrop + weather particles) that scales brightness,
 * saturation, and hue-rotation so the image actually *looks* like the
 * time of day — not just dimmer. Night is cool + desaturated; noon is
 * neutral; golden hour bumps saturation slightly for that amber glow.
 * Per-weather *color* washes still live in WeatherAmbient and stack on
 * top of this exposure treatment.
 */
export function SunlightTint({
  children,
  refreshIntervalMs = 60 * 1000,
  timePreview = 'auto',
}: SunlightTintProps) {
  const [autoSnapshot, setAutoSnapshot] = useState<{ tone: SunlightTone; state: SunlightState }>(() => ({
    tone: resolveSunlightTone(),
    state: resolveSunlightState(),
  }))

  useEffect(() => {
    if (timePreview !== 'auto') return undefined
    const update = () => setAutoSnapshot({
      tone: resolveSunlightTone(),
      state: resolveSunlightState(),
    })
    const intervalId = window.setInterval(update, refreshIntervalMs)
    return () => window.clearInterval(intervalId)
  }, [refreshIntervalMs, timePreview])

  const snapshot = timePreview !== 'auto'
    ? (() => {
      const simulatedDate = dateAtHour(PREVIEW_HOUR[timePreview])
      return {
        tone: resolveSunlightTone(simulatedDate),
        state: resolveSunlightState(simulatedDate),
      }
    })()
    : autoSnapshot

  const { tone, state } = snapshot
  const inlineStyle: CSSProperties = {
    filter: `brightness(${tone.brightness.toFixed(3)}) saturate(${tone.saturation.toFixed(3)}) hue-rotate(${tone.hueRotate.toFixed(2)}deg)`,
  }

  return (
    <div
      className={`scene-sunlight scene-sunlight--${state}`}
      style={inlineStyle}
    >
      {children}
    </div>
  )
}
