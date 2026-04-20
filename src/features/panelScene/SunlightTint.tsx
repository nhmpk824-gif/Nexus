import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { resolveSunlightState, type SunlightState } from './sunlightState.ts'

type SunlightTintProps = {
  children?: ReactNode
  /** Re-check the clock this often (ms). Default 2 minutes — sunlight moods
   * change gradually enough that 2-minute granularity is plenty, and the
   * CSS transition between states smooths any visible step. */
  refreshIntervalMs?: number
}

/**
 * Top layer of the 3-layer pet stage — a container that re-binds the scene
 * palette (via CSS custom properties on `.scene-sunlight--<state>`) as the
 * clock advances through 14 hand-designed time-of-day moods. Places the
 * scene backdrop + animated overlay inside so the palette flows down.
 *
 * The overlay itself paints a subtle wash over the children, tuned per
 * state to match the mood (e.g. warm gold at golden hour, cool blue at
 * deep night). Opacity is small (<15%) so it tints rather than dominates.
 */
export function SunlightTint({
  children,
  refreshIntervalMs = 2 * 60 * 1000,
}: SunlightTintProps) {
  const [state, setState] = useState<SunlightState>(() => resolveSunlightState())

  useEffect(() => {
    const update = () => setState(resolveSunlightState())
    const intervalId = window.setInterval(update, refreshIntervalMs)
    return () => window.clearInterval(intervalId)
  }, [refreshIntervalMs])

  return (
    <div className={`scene-sunlight scene-sunlight--${state}`}>
      {children}
      <div className="scene-sunlight__wash" aria-hidden="true" />
    </div>
  )
}
