import { useEffect, useState } from 'react'
import type { ReactNode, CSSProperties } from 'react'
import { resolveSunlightTone, resolveSunlightState, type SunlightState, type SunlightTone } from './sunlightState.ts'

type SunlightTintProps = {
  children?: ReactNode
  /** Re-check the clock this often (ms). 60s keeps the filter glide
   * smooth across the day without hammering state. The CSS transition
   * on `filter` absorbs the step between readings so no abrupt jumps. */
  refreshIntervalMs?: number
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
}: SunlightTintProps) {
  const [snapshot, setSnapshot] = useState<{ tone: SunlightTone; state: SunlightState }>(() => ({
    tone: resolveSunlightTone(),
    state: resolveSunlightState(),
  }))

  useEffect(() => {
    const update = () => setSnapshot({
      tone: resolveSunlightTone(),
      state: resolveSunlightState(),
    })
    const intervalId = window.setInterval(update, refreshIntervalMs)
    return () => window.clearInterval(intervalId)
  }, [refreshIntervalMs])

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
