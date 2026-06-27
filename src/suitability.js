import { THRESHOLDS } from './config.js'

// Rate a single value against its threshold config.
// Returns 'good' | 'ok' | 'poor'.
function rate(value, t) {
  if (value == null || Number.isNaN(value)) return 'poor'
  if (t.higherIsBetter) {
    if (value >= t.good) return 'good'
    if (value >= t.ok) return 'ok'
    return 'poor'
  }
  if (value <= t.good) return 'good'
  if (value <= t.ok) return 'ok'
  return 'poor'
}

const RATING_RANK = { good: 0, ok: 1, poor: 2 }

// Build a per-factor breakdown plus an overall verdict.
export function evaluate(conditions) {
  const factors = [
    {
      key: 'wind',
      label: 'Wind',
      value: conditions.windSpeed,
      display: `${Math.round(conditions.windSpeed)} km/h`,
      rating: rate(conditions.windSpeed, THRESHOLDS.windSpeed),
      icon: '💨',
    },
    {
      key: 'waves',
      label: 'Waves',
      value: conditions.waveHeight,
      display: `${conditions.waveHeight?.toFixed(2)} m`,
      rating: rate(conditions.waveHeight, THRESHOLDS.waveHeight),
      icon: '🌊',
    },
    {
      key: 'airTemp',
      label: 'Air temp',
      value: conditions.airTemp,
      display: `${Math.round(conditions.airTemp)}°C`,
      rating: rate(conditions.airTemp, THRESHOLDS.airTemp),
      icon: '🌡️',
    },
    {
      key: 'waterTemp',
      label: 'Sea temp',
      value: conditions.waterTemp,
      display: `${conditions.waterTemp?.toFixed(1)}°C`,
      rating: rate(conditions.waterTemp, THRESHOLDS.waterTemp),
      icon: '🐟',
    },
    {
      key: 'rain',
      label: 'Rain (today)',
      value: conditions.rain,
      display: `${conditions.rain?.toFixed(1)} mm`,
      rating: rate(conditions.rain, THRESHOLDS.rain),
      icon: '🌧️',
    },
  ]

  // Tide is shown for context (access/safety) but isn't a pass/fail factor.
  const tide = buildTideFactor(conditions.tide)

  const worst = factors.reduce(
    (acc, f) => (RATING_RANK[f.rating] > RATING_RANK[acc] ? f.rating : acc),
    'good',
  )

  const verdict = {
    poor: {
      level: 'poor',
      title: 'Not a good day for it',
      blurb: 'Conditions look unfavourable for sea paddle-boarding today.',
    },
    ok: {
      level: 'ok',
      title: 'Doable — take care',
      blurb: 'It could work, but conditions are marginal. Check locally before heading out.',
    },
    good: {
      level: 'good',
      title: 'Great day to paddle!',
      blurb: 'Conditions look good for getting out on the water.',
    },
  }[worst]

  return { verdict, factors, tide }
}

function buildTideFactor(tide) {
  if (!tide) return null
  const fmt = (t) =>
    t
      ? new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
      : '—'
  return {
    height: tide.height,
    trend: tide.trend,
    nextHigh: tide.nextHigh ? fmt(tide.nextHigh.time) : null,
    nextLow: tide.nextLow ? fmt(tide.nextLow.time) : null,
  }
}
