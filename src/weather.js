import { CHART_WINDOW_HOURS } from './config.js'
import { CONTENT } from './content.js'

const marineUrl = (loc) =>
  `https://marine-api.open-meteo.com/v1/marine` +
  `?latitude=${loc.lat}&longitude=${loc.lon}` +
  `&hourly=wave_height,sea_level_height_msl,sea_surface_temperature` +
  `&timezone=auto&forecast_days=2`

const forecastUrl = (loc) =>
  `https://api.open-meteo.com/v1/forecast` +
  `?latitude=${loc.lat}&longitude=${loc.lon}` +
  `&current=temperature_2m,weather_code` +
  `&hourly=temperature_2m,wind_speed_10m,wind_direction_10m,precipitation` +
  `&timezone=auto&forecast_days=2`

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

// Timestamped values for a rolling window from the current hour, for
// sparklines. Equal hourly spacing keeps the X axis time-correct.
function rollingSeries(times, values, fromIndex) {
  const out = []
  const end = Math.min(fromIndex + CHART_WINDOW_HOURS, values.length - 1)
  for (let i = fromIndex; i <= end; i++) {
    out.push({ t: new Date(times[i]).getTime(), v: values[i] })
  }
  return out
}

// Peak-to-trough spread of a numeric series (used for the tidal range).
function seriesRange(values) {
  const nums = values.filter((v) => v != null && !Number.isNaN(v))
  if (!nums.length) return 0
  return Math.max(...nums) - Math.min(...nums)
}

// Smallest angle (degrees) between two compass bearings.
function angularDistance(a, b) {
  const d = Math.abs((((a - b) % 360) + 360) % 360)
  return d > 180 ? 360 - d : d
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
    highs: events.filter((e) => e.type === 'high').map((e) => e.ms),
    lows: events.filter((e) => e.type === 'low').map((e) => e.ms),
  }
}

export async function fetchConditions(location) {
  const [marineRes, forecastRes] = await Promise.all([
    fetch(marineUrl(location)),
    fetch(forecastUrl(location)),
  ])
  if (!forecastRes.ok) {
    throw new Error(CONTENT.status.error)
  }
  if (!marineRes.ok) {
    throw noSeaError()
  }
  const marine = await marineRes.json()
  const forecast = await forecastRes.json()

  const mh = marine.hourly
  const fh = forecast.hourly
  const idxM = currentHourIndex(mh.time)
  const idxF = currentHourIndex(fh.time)

  // Inland spots: the marine API answers, but with empty/null sea data.
  if (mh.sea_level_height_msl?.[idxM] == null || mh.wave_height?.[idxM] == null) {
    throw noSeaError()
  }

  const tide = tideInfo(mh.time, mh.sea_level_height_msl)

  // Offshore-ness: 0° = wind from the sea (onshore) … 180° = straight offshore.
  const facing = location.facing ?? 180
  const offshoreness = fh.wind_direction_10m.map((d) =>
    d == null ? null : angularDistance(d, facing),
  )

  // Each factor gets its current-hour value plus a rolling 12h series.
  const field = (times, values, idx) => ({
    now: values[idx],
    series: rollingSeries(times, values, idx),
  })

  return {
    observedAt: forecast.current.time,
    airTempNow: forecast.current.temperature_2m,
    weatherCode: forecast.current.weather_code,
    factors: {
      wind: field(fh.time, fh.wind_speed_10m, idxF),
      windDir: {
        ...field(fh.time, offshoreness, idxF),
        bearing: fh.wind_direction_10m[idxF],
      },
      waves: field(mh.time, mh.wave_height, idxM),
      airTemp: field(fh.time, fh.temperature_2m, idxF),
      waterTemp: field(mh.time, mh.sea_surface_temperature, idxM),
      rain: field(fh.time, fh.precipitation, idxF),
    },
    tide: {
      height: mh.sea_level_height_msl[idxM],
      range: seriesRange(mh.sea_level_height_msl),
      trend: tide.trend,
      nextHigh: tide.nextHigh,
      nextLow: tide.nextLow,
      nearestHigh: tide.nearestHigh,
      nearestLow: tide.nearestLow,
      highs: tide.highs,
      lows: tide.lows,
      series: rollingSeries(mh.time, mh.sea_level_height_msl, idxM),
    },
  }
}

function noSeaError() {
  const err = new Error(CONTENT.setup.noSea)
  err.code = 'nosea'
  return err
}

// WMO weather code → short, friendly description.
export function describeWeather(code) {
  const w = CONTENT.weather
  if (code == null) return w.unknown
  if (code === 0) return w.clear
  if (code <= 2) return w.mostlySunny
  if (code === 3) return w.overcast
  if (code <= 48) return w.fog
  if (code <= 57) return w.drizzle
  if (code <= 67) return w.rain
  if (code <= 77) return w.snow
  if (code <= 82) return w.rainShowers
  if (code <= 86) return w.snowShowers
  return w.thunderstorm
}
