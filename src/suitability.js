import {
  THRESHOLDS,
  WIND_DIR_BANDS,
  TIDE_GREEN_WINDOW_MIN,
  TIDE_SMALL_RANGE_M,
  RAIN_WET_MM,
} from './config.js'
import { CONTENT } from './content.js'

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

const fmtTime = (t) =>
  t ? new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—'

// Build a per-factor breakdown plus an overall verdict.
export function evaluate(conditions) {
  const f = conditions.factors
  const U = CONTENT.factors
  const factors = [
    buildValueFactor('wind', f.wind, THRESHOLDS.windSpeed, (v) =>
      `${Math.round(v)} ${U.wind.unit}`,
    ),
    buildWindDirFactor(f.windDir),
    buildValueFactor('waves', f.waves, THRESHOLDS.waveHeight, (v) =>
      `${v.toFixed(2)} ${U.waves.unit}`,
    ),
    buildValueFactor('airTemp', f.airTemp, THRESHOLDS.airTemp, (v) =>
      `${Math.round(v)}${U.airTemp.unit}`,
    ),
    buildValueFactor('waterTemp', f.waterTemp, THRESHOLDS.waterTemp, (v) =>
      `${v.toFixed(1)}${U.waterTemp.unit}`,
    ),
    buildRainFactor(f.rain),
  ]

  // Tide is a rated factor too: best around high water.
  const tideFactor = buildTideFactor(conditions.tide)
  if (tideFactor) factors.push(tideFactor)

  // Some factors minimise to a compact box (and drop out of the verdict) when
  // they can't matter here:
  //  - wind direction is moot unless wind speed is marginal (calm = irrelevant,
  //    gale = poor whichever way it blows);
  //  - tide barely moves where the tidal range is tiny.
  const windFactor = factors.find((x) => x.key === 'wind')
  const dirFactor = factors.find((x) => x.key === 'windDir')
  const tideFactorObj = factors.find((x) => x.key === 'tide')
  if (dirFactor) dirFactor.minimised = windFactor.rating !== 'ok'
  if (tideFactorObj) {
    tideFactorObj.minimised = (conditions.tide?.range ?? Infinity) < TIDE_SMALL_RANGE_M
  }

  const verdictFactors = factors.map((x) => {
    // Wind direction is masked time-aware: it only counts while wind is amber.
    if (x.key === 'windDir') return maskedWindDir(windFactor.pts, dirFactor.pts)
    // A minimised tide is dropped from the verdict entirely.
    if (x.key === 'tide' && x.minimised) return { key: 'tide', rating: 'good', markers: [] }
    return x
  })

  const worst = verdictFactors.reduce(
    (acc, f) => (RATING_RANK[f.rating] > RATING_RANK[acc] ? f.rating : acc),
    'good',
  )

  const verdict = { level: worst, ...CONTENT.verdicts[worst] }

  return { verdict, factors, nextChange: nextOverallChange(verdictFactors) }
}

// A factor's piecewise rating over time: initial rating plus exact-change events.
function timelineOf(pts) {
  const events = []
  for (let i = 0; i < pts.length - 1; i++) {
    for (const s of pts[i].splits || []) {
      events.push({ t: pts[i].t + s.f * (pts[i + 1].t - pts[i].t), rating: s.rating })
    }
  }
  return { initial: pts[0]?.rating ?? 'good', events: events.sort((a, b) => a.t - b.t) }
}

// Effective wind-direction rating: the raw direction rating while wind speed
// is 'ok', neutral ('good') otherwise. Returns a shadow factor with the same
// shape nextOverallChange and the worst-of reduce consume.
function maskedWindDir(windPts, dirPts) {
  const wind = timelineOf(windPts)
  const dir = timelineOf(dirPts)
  const all = [
    ...wind.events.map((e) => ({ ...e, src: 'wind' })),
    ...dir.events.map((e) => ({ ...e, src: 'dir' })),
  ].sort((a, b) => a.t - b.t)

  let windR = wind.initial
  let dirR = dir.initial
  const eff = () => (windR === 'ok' ? dirR : 'good')
  const initial = eff()
  let cur = initial
  const markers = []
  for (const e of all) {
    if (e.src === 'wind') windR = e.rating
    else dirR = e.rating
    const now = eff()
    if (now !== cur) {
      markers.push({ type: 'transition', t: e.t, rating: now })
      cur = now
    }
  }
  return { key: 'windDir', rating: initial, markers }
}

// The first moment the overall (worst-of) status will change, found by
// replaying every factor's exact rating-change times in order. Returns
// { t, label, from, to, direction } or null if steady all window.
function nextOverallChange(factors) {
  const current = {}
  const events = []
  for (const f of factors) {
    current[f.key] = f.rating
    for (const m of f.markers || []) {
      if (m.type === 'transition' && m.t != null) {
        events.push({ key: f.key, t: m.t, rating: m.rating })
      }
    }
  }
  events.sort((a, b) => a.t - b.t)

  const worstOf = () =>
    Object.values(current).reduce((a, r) => (RATING_RANK[r] > RATING_RANK[a] ? r : a), 'good')

  const from = worstOf()
  for (const e of events) {
    if (e.t <= Date.now()) {
      current[e.key] = e.rating
      continue
    }
    current[e.key] = e.rating
    const now = worstOf()
    if (now !== from) {
      return {
        t: e.t,
        label: fmtTime(e.t),
        from,
        to: now,
        direction: RATING_RANK[now] < RATING_RANK[from] ? 'improves' : 'worsens',
      }
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Generic chart series + markers
// ---------------------------------------------------------------------------

// Where the rating changes between two points, find the exact fraction(s) in
// [0,1] where the value crosses a boundary, so the chart's colour switches at
// the true crossing time rather than the midpoint. A single hour can cross two
// thresholds (good→ok→poor), so this returns 0, 1 or 2 splits.
function segmentSplits(va, vb, boundaries, rateVal) {
  if (va === vb) return []
  const lo = Math.min(va, vb)
  const hi = Math.max(va, vb)
  const cuts = boundaries
    .filter((T) => T > lo && T < hi)
    .map((T) => (T - va) / (vb - va))
    .filter((f) => f > 0 && f < 1)
    .sort((a, b) => a - b)

  const splits = []
  const bounds = [0, ...cuts, 1]
  for (let k = 1; k < bounds.length; k++) {
    const fMid = (bounds[k - 1] + bounds[k]) / 2
    const rating = rateVal(va + fMid * (vb - va))
    if (k > 1) splits.push({ f: bounds[k - 1], rating })
  }
  // Safety net: ratings differ but no crossing was captured (value landed
  // exactly on a boundary) — fall back to a midpoint split.
  if (splits.length === 0 && rateVal(va) !== rateVal(vb)) {
    splits.push({ f: 0.5, rating: rateVal(vb) })
  }
  return splits
}

// Turn a {t,v} series into coloured chart points with exact colour boundaries.
function buildSeries(series, rateVal, boundaries) {
  const pts = series.map((p) => ({ t: p.t, v: p.v, rating: rateVal(p.v) }))
  for (let i = 0; i < pts.length - 1; i++) {
    pts[i].splits = segmentSplits(pts[i].v, pts[i + 1].v, boundaries, rateVal)
  }
  return pts
}

// A callout at every rating change, carrying the rating it transitions *into*
// (so the line/label can be coloured accordingly) and the exact crossing time.
function transitionMarkers(pts) {
  if (pts.length < 2) return []
  const t0 = pts[0].t
  const span = pts[pts.length - 1].t - t0 || 1
  const out = []
  for (let i = 0; i < pts.length - 1; i++) {
    for (const s of pts[i].splits || []) {
      const t = pts[i].t + s.f * (pts[i + 1].t - pts[i].t)
      out.push({
        type: 'transition',
        rating: s.rating,
        t,
        xFrac: (t - t0) / span,
        label: fmtTime(t),
      })
    }
  }
  return out
}

function toSeries(pts) {
  return pts.map((p) => ({ v: p.v, rating: p.rating, splits: p.splits }))
}

// ---------------------------------------------------------------------------
// Factor builders
// ---------------------------------------------------------------------------

function buildValueFactor(key, data, cfg, format) {
  const meta = CONTENT.factors[key]
  const rateVal = (v) => rate(v, cfg)
  const pts = buildSeries(data.series, rateVal, [cfg.good, cfg.ok])
  return {
    key,
    label: meta.label,
    icon: meta.icon,
    value: data.now,
    display: format(data.now),
    rating: rateVal(data.now),
    pts,
    series: toSeries(pts),
    chart: 'area',
    markers: transitionMarkers(pts),
  }
}

// Wind direction rates "offshore-ness" — the angular distance between where
// the wind blows from and the beach's seaward facing (0° onshore … 180°
// offshore). Onshore is good; offshore blows you out to sea, so it's poor.
function buildWindDirFactor(data) {
  const meta = CONTENT.factors.windDir
  const rateVal = (v) => {
    if (v == null || Number.isNaN(v)) return 'poor'
    if (v <= WIND_DIR_BANDS.onshoreMax) return 'good'
    if (v <= WIND_DIR_BANDS.crossMax) return 'ok'
    return 'poor'
  }
  const pts = buildSeries(data.series, rateVal, [
    WIND_DIR_BANDS.onshoreMax,
    WIND_DIR_BANDS.crossMax,
  ])
  const rating = rateVal(data.now)
  const cardinal = CONTENT.cardinals[Math.round(data.bearing / 22.5) % 16]
  return {
    key: 'windDir',
    label: meta.label,
    icon: meta.icon,
    value: data.now,
    display: `${cardinal} · ${CONTENT.windWords[rating]}`,
    rating,
    pts,
    series: toSeries(pts),
    chart: 'area',
    markers: transitionMarkers(pts),
  }
}

// Rain is a simple dry/wet (green/red) call per hour.
function buildRainFactor(data) {
  const meta = CONTENT.factors.rain
  const rateVal = (v) => (v < RAIN_WET_MM ? 'good' : 'poor')
  const pts = buildSeries(data.series, rateVal, [RAIN_WET_MM])
  return {
    key: 'rain',
    label: meta.label,
    icon: meta.icon,
    value: data.now,
    display: `${data.now.toFixed(1)} ${meta.unit}`,
    rating: rateVal(data.now),
    series: toSeries(pts),
    chart: 'area',
    markers: transitionMarkers(pts),
  }
}

// ---------------------------------------------------------------------------
// Tide (special: rating depends on time-to-high-water, not the value)
// ---------------------------------------------------------------------------

// Tide is green within ±2h of a high tide, red otherwise.
function rateTideAt(ms, highs) {
  if (!highs || !highs.length) return 'poor'
  const nearestMin = Math.min(...highs.map((h) => Math.abs(ms - h))) / 60000
  return nearestMin <= TIDE_GREEN_WINDOW_MIN ? 'good' : 'poor'
}

function buildTideFactor(tide) {
  if (!tide) return null
  const meta = CONTENT.factors.tide
  const arrow = tide.trend === 'rising' ? meta.rising : tide.trend === 'falling' ? meta.falling : ''
  const height = tide.height != null ? `${tide.height.toFixed(1)} ${meta.unit}` : '—'
  const pts = buildTidePoints(tide)
  return {
    key: 'tide',
    label: meta.label,
    value: tide.height,
    display: `${arrow} ${height}`.trim(),
    rating: rateTideAt(Date.now(), tide.highs),
    icon: meta.icon,
    series: toSeries(pts),
    chart: 'area',
    // High/low turning points, plus a callout at every green↔red transition.
    markers: [...tideExtremaMarkers(tide), ...transitionMarkers(pts)],
  }
}

// Colour each point by its rating, splitting segments at the exact window edge.
function buildTidePoints(tide) {
  const highs = tide.highs || []
  const pts = tide.series.map((p) => ({ v: p.v, t: p.t, rating: rateTideAt(p.t, highs) }))
  for (let i = 0; i < pts.length - 1; i++) {
    if (pts[i].rating === pts[i + 1].rating) {
      pts[i].splits = []
      continue
    }
    const b = tideRatingBoundary(pts[i].t, pts[i + 1].t, highs)
    const f = b != null ? (b - pts[i].t) / (pts[i + 1].t - pts[i].t) : 0.5
    pts[i].splits = [{ f, rating: pts[i + 1].rating }]
  }
  return pts
}

// The exact time in [ta, tb] where the green/red rating flips — i.e. a high
// tide's window edge (high ± 2h) that falls inside the interval.
function tideRatingBoundary(ta, tb, highs) {
  const win = TIDE_GREEN_WINDOW_MIN * 60000
  let best = null
  for (const h of highs) {
    for (const edge of [h - win, h + win]) {
      if (edge >= ta && edge <= tb && (best == null || edge < best)) best = edge
    }
  }
  return best
}

// Tide high/low turning points within the visible window. (Green↔red
// transition callouts come from the generic transitionMarkers.)
function tideExtremaMarkers(tide) {
  const series = tide.series
  if (!series || series.length < 2) return []
  const t0 = series[0].t
  const tN = series[series.length - 1].t
  const span = tN - t0 || 1

  const events = [
    ...(tide.highs || []).map((t) => ({ t, type: 'high' })),
    ...(tide.lows || []).map((t) => ({ t, type: 'low' })),
  ]
  return events
    .filter((e) => e.t >= t0 && e.t <= tN)
    .map((e) => ({ type: e.type, xFrac: (e.t - t0) / span, label: fmtTime(e.t) }))
}
