import { LOCATION } from './config.js'

const MARINE_URL =
  `https://marine-api.open-meteo.com/v1/marine` +
  `?latitude=${LOCATION.lat}&longitude=${LOCATION.lon}` +
  `&hourly=wave_height,sea_level_height_msl,sea_surface_temperature` +
  `&timezone=auto&forecast_days=2`

const FORECAST_URL =
  `https://api.open-meteo.com/v1/forecast` +
  `?latitude=${LOCATION.lat}&longitude=${LOCATION.lon}` +
  `&current=temperature_2m,wind_speed_10m,precipitation,weather_code` +
  `&daily=temperature_2m_max,wind_speed_10m_max,precipitation_sum,weather_code` +
  `&timezone=auto&forecast_days=1`

// Index of the hourly entry closest to "now".
function currentHourIndex(times) {
  const now = Date.now()
  let best = 0
  let bestDiff = Infinity
  for (let i = 0; i < times.length; i++) {
    const diff = Math.abs(new Date(times[i]).getTime() - now)
    if (diff < bestDiff) {
      bestDiff = diff
      best = i
    }
  }
  return best
}

// Walk the tidal height series to find high/low turning points, then pick out
// the next ones (for display) and the nearest ones in time (for rating — we may
// be just *after* a high tide, which a "next" lookup would miss).
function tideInfo(times, heights) {
  const now = Date.now()
  const events = []
  for (let i = 1; i < heights.length - 1; i++) {
    const prev = heights[i - 1]
    const curr = heights[i]
    const next = heights[i + 1]
    if (prev == null || curr == null || next == null) continue
    const ms = new Date(times[i]).getTime()
    if (curr >= prev && curr > next) {
      events.push({ type: 'high', time: times[i], ms, height: curr })
    } else if (curr <= prev && curr < next) {
      events.push({ type: 'low', time: times[i], ms, height: curr })
    }
  }

  const nearestOfType = (type) =>
    events
      .filter((e) => e.type === type)
      .reduce((best, e) => {
        const d = Math.abs(e.ms - now)
        return !best || d < best._d ? { ...e, _d: d } : best
      }, null)

  const nextOfType = (type) =>
    events.find((e) => e.type === type && e.ms >= now) || null

  const nextHigh = nextOfType('high')
  const nextLow = nextOfType('low')
  // Rising if the upcoming event is a high tide.
  let trend = 'steady'
  if (nextHigh && nextLow) trend = nextHigh.ms < nextLow.ms ? 'rising' : 'falling'
  else if (nextHigh) trend = 'rising'
  else if (nextLow) trend = 'falling'

  return {
    trend,
    nextHigh,
    nextLow,
    nearestHigh: nearestOfType('high'),
    nearestLow: nearestOfType('low'),
  }
}

export async function fetchConditions() {
  const [marineRes, forecastRes] = await Promise.all([
    fetch(MARINE_URL),
    fetch(FORECAST_URL),
  ])
  if (!marineRes.ok || !forecastRes.ok) {
    throw new Error('Weather service is unavailable right now. Please try again.')
  }
  const marine = await marineRes.json()
  const forecast = await forecastRes.json()

  const h = marine.hourly
  const idx = currentHourIndex(h.time)
  const tide = tideInfo(h.time, h.sea_level_height_msl)

  return {
    observedAt: forecast.current.time,
    windSpeed: forecast.current.wind_speed_10m,
    windSpeedMax: forecast.daily.wind_speed_10m_max[0],
    airTemp: forecast.daily.temperature_2m_max[0],
    airTempNow: forecast.current.temperature_2m,
    rain: forecast.daily.precipitation_sum[0],
    weatherCode: forecast.current.weather_code,
    waveHeight: h.wave_height[idx],
    waterTemp: h.sea_surface_temperature[idx],
    tide: {
      height: h.sea_level_height_msl[idx],
      trend: tide.trend,
      nextHigh: tide.nextHigh,
      nextLow: tide.nextLow,
      nearestHigh: tide.nearestHigh,
      nearestLow: tide.nearestLow,
    },
  }
}

// WMO weather code → short, friendly description.
export function describeWeather(code) {
  if (code == null) return 'Unknown'
  if (code === 0) return 'Clear sky'
  if (code <= 2) return 'Mostly sunny'
  if (code === 3) return 'Overcast'
  if (code <= 48) return 'Foggy'
  if (code <= 57) return 'Drizzle'
  if (code <= 67) return 'Rain'
  if (code <= 77) return 'Snow'
  if (code <= 82) return 'Rain showers'
  if (code <= 86) return 'Snow showers'
  return 'Thunderstorm'
}
