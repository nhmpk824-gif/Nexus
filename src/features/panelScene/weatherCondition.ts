export type WeatherCondition =
  | 'clear'
  | 'cloudy'
  | 'fog'
  | 'rain'
  | 'snow'
  | 'thunder'
  | 'wind'

export type TimeOfDayBand = 'day' | 'dusk' | 'night'

const WIND_THRESHOLD_KMH = 24

export function classifyWeatherCondition(
  weatherCode: number | null | undefined,
  windSpeedKmh: number | null | undefined,
): WeatherCondition | null {
  if (weatherCode == null) return null

  const base = classifyFromWmoCode(weatherCode)
  if (!base) return null

  const wind = typeof windSpeedKmh === 'number' ? windSpeedKmh : 0
  if (wind >= WIND_THRESHOLD_KMH && (base === 'clear' || base === 'cloudy')) {
    return 'wind'
  }
  return base
}

function classifyFromWmoCode(code: number): WeatherCondition | null {
  if (code === 0) return 'clear'
  if (code >= 1 && code <= 3) return 'cloudy'
  if (code === 45 || code === 48) return 'fog'
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain'
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow'
  if (code >= 95 && code <= 99) return 'thunder'
  return null
}

export function getTimeOfDayBand(date: Date = new Date()): TimeOfDayBand {
  const hour = date.getHours()
  if (hour >= 6 && hour < 17) return 'day'
  if (hour >= 17 && hour < 20) return 'dusk'
  return 'night'
}
