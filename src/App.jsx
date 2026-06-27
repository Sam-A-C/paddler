import { useEffect, useState } from 'react'
import { LOCATION } from './config.js'
import { CONTENT } from './content.js'
import { fetchConditions, describeWeather } from './weather.js'
import { evaluate } from './suitability.js'

const RATING_EMOJI = CONTENT.ratingEmoji

export default function App() {
  const [state, setState] = useState({ status: 'loading' })

  async function load() {
    setState({ status: 'loading' })
    try {
      const conditions = await fetchConditions()
      const result = evaluate(conditions)
      setState({ status: 'ready', conditions, result })
    } catch (err) {
      setState({ status: 'error', message: err.message })
    }
  }

  useEffect(() => {
    load()
  }, [])

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <div className="page">
      <main className="card">
        <header className="header">
          <div className="brand">{CONTENT.brand}</div>
          <div className="location">
            {LOCATION.name} <span className="region">· {LOCATION.region}</span>
          </div>
          <div className="date">{today}</div>
        </header>

        {state.status === 'loading' && <p className="status">{CONTENT.status.loading}</p>}

        {state.status === 'error' && (
          <div className="status error">
            <p>{state.message}</p>
            <button onClick={load}>{CONTENT.status.retry}</button>
          </div>
        )}

        {state.status === 'ready' && (
          <Result conditions={state.conditions} result={state.result} onRefresh={load} />
        )}
      </main>
      <footer className="footer">
        {CONTENT.footer.before}
        <a href={CONTENT.footer.linkUrl} target="_blank" rel="noreferrer">
          {CONTENT.footer.linkText}
        </a>
        {CONTENT.footer.after}
      </footer>
    </div>
  )
}

function Result({ conditions, result, onRefresh }) {
  const { verdict, factors } = result
  return (
    <>
      <section className={`verdict verdict-${verdict.level}`}>
        <h1>{verdict.title}</h1>
        <p>{verdict.blurb}</p>
        <p className="weather-now">
          {CONTENT.nowPrefix} {describeWeather(conditions.weatherCode)},{' '}
          {Math.round(conditions.airTempNow)}
          {CONTENT.factors.airTemp.unit}
        </p>
      </section>

      <section className="factors">
        {factors.map((f) => {
          const hasChart = f.series && f.series.length > 1
          return (
            <div
              key={f.key}
              className={`factor factor-${f.rating}${hasChart ? ' factor--chart' : ''}`}
            >
              <span className="factor-icon">{f.icon}</span>
              <span className="factor-label">{f.label}</span>
              <span className="factor-value">{f.display}</span>
              <span className="factor-rating">{RATING_EMOJI[f.rating]}</span>
              {hasChart && <Sparkline points={f.series} kind={f.chart} markers={f.markers} />}
            </div>
          )
        })}
      </section>

      <button className="refresh" onClick={onRefresh}>
        {CONTENT.status.refresh}
      </button>
    </>
  )
}

// Tiny inline chart for a factor's rest-of-day trend.
// X is time-correct (equal hourly spacing); Y auto-scales to the visible range.
// `points` is [{ v, rating }]; each segment is coloured by its rating, so the
// chart can change colour along the time axis. Segments split at midpoints so
// the colour can switch between two adjacent points.
function Sparkline({ points, kind = 'line', markers = [] }) {
  const w = 100
  const h = 34
  const padY = 3
  const vals = points.map((p) => p.v)
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const range = max - min || 1
  const np = points.length
  const n = (x) => x.toFixed(1)
  const labelShown = visibleLabels(markers)

  // Geometry over a *fractional* index t (0..np-1). X spans the full width so it
  // matches the overlay markers; Y is a smooth Catmull-Rom curve through the
  // points, clamped so the area never folds past its baseline.
  const Xt = (t) => (w * t) / (np - 1)
  const Yt = (t) => {
    if (np < 2) return Yv(vals[0])
    const i = Math.max(0, Math.min(Math.floor(t), np - 2))
    const lt = t - i
    const v = catmullRom(
      vals[Math.max(i - 1, 0)],
      vals[i],
      vals[i + 1],
      vals[Math.min(i + 2, np - 1)],
      lt,
    )
    return Math.max(0, Math.min(h, Yv(v)))
  }
  function Yv(v) {
    return padY + (h - padY * 2) * (1 - (v - min) / range)
  }

  // Colour-change boundaries in index space, and the rating at any index.
  const changes = []
  for (let i = 0; i < np - 1; i++) {
    for (const s of points[i].splits || []) changes.push({ t: i + s.f, rating: s.rating })
  }
  changes.sort((a, b) => a.t - b.t)
  const colourAt = (t) => {
    let r = points[0].rating
    for (const c of changes) {
      if (c.t <= t + 1e-9) r = c.rating
      else break
    }
    return r
  }

  // Sample the curve finely (plus the exact boundary positions) and split it
  // into maximal same-colour runs, so colour switches land exactly on boundaries.
  const STEP = 1 / 10
  const ts = []
  for (let t = 0; t <= np - 1 + 1e-9; t += STEP) ts.push(Math.min(t, np - 1))
  for (const c of changes) ts.push(c.t)
  ts.sort((a, b) => a - b)

  const areas = []
  const lines = []
  const addPiece = (verts, rating, key) => {
    if (verts.length < 2) return
    const line = verts.map(([x, y], k) => `${k ? 'L' : 'M'}${n(x)} ${n(y)}`).join(' ')
    if (kind === 'area') {
      const a = verts[0]
      const b = verts[verts.length - 1]
      areas.push(
        <path
          key={`a${key}`}
          className={`spark-area spark-fill-${rating}`}
          d={`${line} L${n(b[0])} ${h} L${n(a[0])} ${h} Z`}
        />,
      )
    }
    lines.push(
      <path key={`l${key}`} className={`spark-line spark-stroke-${rating}`} d={line} fill="none" />,
    )
  }

  let curRating = colourAt(0)
  let cur = []
  let key = 0
  let prevT = null
  for (const t of ts) {
    if (prevT !== null && Math.abs(t - prevT) < 1e-9) continue
    prevT = t
    const vert = [Xt(t), Yt(t)]
    const col = colourAt(t)
    if (col !== curRating && cur.length) {
      cur.push(vert) // close the old run on the boundary…
      addPiece(cur, curRating, key++)
      cur = [vert] // …and start the new run from the same point
      curRating = col
    } else {
      curRating = col
      cur.push(vert)
    }
  }
  addPiece(cur, curRating, key++)

  return (
    <span className="spark-wrap">
      <svg
        className="spark"
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {areas}
        {lines}
      </svg>
      {markers.flatMap((m, i) => {
        const tone = m.rating ? ` spark-to-${m.rating}` : ''
        const els = [
          <span
            key={`v${i}`}
            className={`spark-vline spark-vline-${m.type}${tone}`}
            style={{ left: `${(m.xFrac * 100).toFixed(1)}%` }}
          />,
        ]
        // Only the first label of an overlapping cluster is shown (lines stay).
        if (labelShown.has(i)) {
          els.push(
            <span
              key={`t${i}`}
              className={`spark-label spark-label-${m.type}${tone}`}
              style={markerStyle(m.xFrac)}
            >
              {markerPrefix(m)} {m.label}
            </span>,
          )
        }
        return els
      })}
    </span>
  )
}

// Decide which marker labels to render: walking left→right, drop any whose
// position is within MIN_LABEL_GAP of the last one we kept.
const MIN_LABEL_GAP = 0.15
function visibleLabels(markers) {
  const shown = new Set()
  let lastX = -Infinity
  for (const { i, xFrac } of markers
    .map((m, i) => ({ i, xFrac: m.xFrac }))
    .sort((a, b) => a.xFrac - b.xFrac)) {
    if (xFrac - lastX >= MIN_LABEL_GAP) {
      shown.add(i)
      lastX = xFrac
    }
  }
  return shown
}

// Uniform Catmull-Rom interpolation between p1 and p2 (t in [0,1]).
function catmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t
  const t3 = t2 * t
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  )
}

function markerPrefix(m) {
  const M = CONTENT.markers
  if (m.type === 'high') return M.high
  if (m.type === 'low') return M.low
  if (m.rating === 'good') return M.becomesGood
  if (m.rating === 'poor') return M.becomesPoor
  return M.becomesOk // becomes marginal (ok)
}

// Keep the under-axis label inside the chart: anchor to the nearer edge when
// close to it, otherwise centre it on the marker line.
function markerStyle(xFrac) {
  if (xFrac <= 0.08) return { left: 0 }
  if (xFrac >= 0.92) return { right: 0 }
  return { left: `${(xFrac * 100).toFixed(1)}%`, transform: 'translateX(-50%)' }
}
