import { useEffect, useMemo, useRef, useState } from 'react'
import type { WeatherLookupResponse } from '../types'

/**
 * Compact view of the full weather response, tailored for the corner chip.
 * Fields are nullable when the upstream response omitted them (older build,
 * parser failure) so the chip can degrade to "location only" rather than
 * disappearing entirely.
 */
export type AmbientWeatherSnapshot = {
  resolvedName: string
  temperatureC: number | null
  conditionLabel: string
  fullSummary: string
  weatherCode: number | null
  windSpeedKmh: number | null
  fetchedAt: number
}

// Internal shape — tags the snapshot with the query it was produced for so
// the render pass can silently ignore stale data after the user edits the
// location setting (rather than flashing yesterday's weather for the wrong
// city while the next fetch is in flight).
type TaggedSnapshot = AmbientWeatherSnapshot & { forLocation: string }

const POLL_INTERVAL_MS = 30 * 60 * 1000 // 30 minutes
const FIRST_FETCH_DELAY_MS = 3_000       // let the UI settle before the first call

/**
 * Poll the existing weather tool IPC (`window.desktopPet.getWeather`) at a
 * leisurely cadence so the panel can render a small ambient weather chip.
 * Silent about failures — the chip just disappears if the network or
 * geocoder falls over, rather than splashing an error in the user's face.
 *
 * Location and enabled flag are read from AppSettings. When either changes
 * we kick a fresh fetch on the next tick instead of waiting for the next
 * half-hour cycle, so editing the location in Settings feels responsive.
 */
export function useAmbientWeather(
  location: string,
  enabled: boolean,
): AmbientWeatherSnapshot | null {
  const [taggedSnapshot, setTaggedSnapshot] = useState<TaggedSnapshot | null>(null)
  // Track in-flight requests so rapid setting edits don't race each other.
  const requestIdRef = useRef(0)

  const trimmedLocation = location.trim()

  useEffect(() => {
    if (!enabled || !trimmedLocation) return

    let disposed = false
    let firstFetchTimer: number | null = null
    let pollTimer: number | null = null

    const runFetch = async () => {
      if (disposed) return
      const requestId = ++requestIdRef.current
      try {
        const response = await window.desktopPet?.getWeather?.({ location: trimmedLocation })
        if (disposed || requestId !== requestIdRef.current) return
        if (!response) return
        const typed = response as WeatherLookupResponse
        const temperature = typeof typed.currentTemperature === 'number'
          ? typed.currentTemperature
          : null
        setTaggedSnapshot({
          forLocation: trimmedLocation,
          resolvedName: typed.resolvedName || trimmedLocation,
          temperatureC: temperature,
          conditionLabel: typed.currentConditionLabel ?? '',
          fullSummary: typed.currentSummary ?? '',
          weatherCode: typeof typed.currentWeatherCode === 'number' ? typed.currentWeatherCode : null,
          windSpeedKmh: typeof typed.currentWindSpeedKmh === 'number' ? typed.currentWindSpeedKmh : null,
          fetchedAt: Date.now(),
        })
      } catch (err) {
        // Fail quiet — the chip just stays on the last successful snapshot
        // or stays hidden if we never got one. A toast here would be worse
        // than the missing info.
        console.warn('[ambient-weather] fetch failed:', err)
      }
    }

    firstFetchTimer = window.setTimeout(() => {
      void runFetch()
    }, FIRST_FETCH_DELAY_MS)

    pollTimer = window.setInterval(() => {
      void runFetch()
    }, POLL_INTERVAL_MS)

    return () => {
      disposed = true
      if (firstFetchTimer !== null) window.clearTimeout(firstFetchTimer)
      if (pollTimer !== null) window.clearInterval(pollTimer)
    }
  }, [enabled, trimmedLocation])

  // Derive the visible snapshot during render. Hides the chip immediately
  // when the feature is disabled or the location was edited to something
  // other than what we last fetched, instead of flashing stale data.
  return useMemo<AmbientWeatherSnapshot | null>(() => {
    if (!enabled || !trimmedLocation) return null
    if (!taggedSnapshot || taggedSnapshot.forLocation !== trimmedLocation) return null
    return {
      resolvedName: taggedSnapshot.resolvedName,
      temperatureC: taggedSnapshot.temperatureC,
      conditionLabel: taggedSnapshot.conditionLabel,
      fullSummary: taggedSnapshot.fullSummary,
      weatherCode: taggedSnapshot.weatherCode,
      windSpeedKmh: taggedSnapshot.windSpeedKmh,
      fetchedAt: taggedSnapshot.fetchedAt,
    }
  }, [enabled, trimmedLocation, taggedSnapshot])
}
