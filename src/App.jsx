import { useEffect, useRef, useState } from 'react'
import { DEFAULT_LOCATION } from './config.js'
import { CONTENT } from './content.js'
import { fetchConditions, describeWeather } from './weather.js'
import { evaluate } from './suitability.js'
import { searchLocations, guessFacing } from './geo.js'

const RATING_EMOJI = CONTENT.ratingEmoji
const PREFS_KEY = 'paddler:prefs'

function loadPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY))
    if (!p?.name || !p?.location?.name || p.location.lat == null) return null
    return p
  } catch {
    return null
  }
}

// Fill {placeholders}, then tidy the spacing/punctuation left by empty values.
function fill(tpl, vars) {
  return tpl
    .replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '')
    .replace(/\s+([!?.,])/g, '$1')
    .replace(/ {2,}/g, ' ')
    .trim()
}

export default function App() {
  const [prefs, setPrefs] = useState(loadPrefs)
  const [editing, setEditing] = useState(false)
  const [setupError, setSetupError] = useState(null)
  const [state, setState] = useState({ status: 'loading' })

  const inSetup = !prefs || editing

  async function load(location) {
    setState({ status: 'loading' })
    try {
      const conditions = await fetchConditions(location)
      const result = evaluate(conditions)
      setState({ status: 'ready', conditions, result })
    } catch (err) {
      if (err.code === 'nosea') {
        setSetupError(err.message)
        setEditing(true)
        return
      }
      setState({ status: 'error', message: err.message })
    }
  }

  useEffect(() => {
    if (prefs && !editing) load(prefs.location)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs])

  function handleSave(next) {
    localStorage.setItem(PREFS_KEY, JSON.stringify(next))
    setSetupError(null)
    setEditing(false)
    setPrefs(next) // new object identity → the effect above refetches
  }

  function handleReset() {
    localStorage.removeItem(PREFS_KEY)
    setSetupError(null)
    setEditing(true) // prefs kept in memory to pre-fill the form
  }

  function handleCancel() {
    setEditing(false)
    setSetupError(null)
    if (state.status !== 'ready') load(prefs.location)
  }

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <div className="page">
      <main className="card">
        {!inSetup && (
          <button
            className="reset"
            onClick={handleReset}
            title={CONTENT.resetTitle}
            aria-label={CONTENT.resetTitle}
          >
            {CONTENT.reset}
          </button>
        )}
        <header className="header">
          <div className="brand">{CONTENT.brand}</div>
          {!inSetup && (
            <>
              <button className="location" onClick={() => setEditing(true)}>
                {prefs.location.name} <span className="region">· {prefs.location.region}</span>
              </button>
              <div className="date">{today}</div>
            </>
          )}
        </header>

        {inSetup ? (
          <Setup
            initial={prefs || { name: '', location: DEFAULT_LOCATION }}
            error={setupError}
            canCancel={!!prefs && editing && !setupError}
            onCancel={handleCancel}
            onSave={handleSave}
          />
        ) : (
          <>
            {state.status === 'loading' && <p className="status">{CONTENT.status.loading}</p>}

            {state.status === 'error' && (
              <div className="status error">
                <p>{state.message}</p>
                <button onClick={() => load(prefs.location)}>{CONTENT.status.retry}</button>
              </div>
            )}

            {state.status === 'ready' && (
              <Result
                conditions={state.conditions}
                result={state.result}
                name={prefs.name}
                onRefresh={() => load(prefs.location)}
              />
            )}
          </>
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

// First-run setup and location picker: name, beach search, facing confirm.
function Setup({ initial, error, canCancel, onCancel, onSave }) {
  const S = CONTENT.setup
  const [name, setName] = useState(initial.name || '')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [searching, setSearching] = useState(false)
  const [chosen, setChosen] = useState(initial.location || null)
  const [facing, setFacing] = useState(initial.location?.facing ?? null)
  const [guessing, setGuessing] = useState(false)

  async function runSearch(e) {
    e.preventDefault()
    const q = query.trim()
    if (!q || searching) return
    setSearching(true)
    try {
      setResults(await searchLocations(q))
    } catch {
      setResults([])
    }
    setSearching(false)
  }

  async function choose(loc) {
    setChosen(loc)
    setResults(null)
    setQuery('')
    setFacing(null)
    setGuessing(true)
    const guess = await guessFacing(loc.lat, loc.lon).catch(() => null)
    setGuessing(false)
    if (guess != null) setFacing(guess)
  }

  const canSave = name.trim() && chosen && facing != null

  return (
    <div className="setup">
      {error ? <p className="setup-error">{error}</p> : <p className="setup-hint">{S.intro}</p>}

      <label className="setup-label">
        {S.nameLabel}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={S.namePlaceholder}
        />
      </label>

      <div className="setup-label">{S.beachLabel}</div>
      {chosen && (
        <div className="chosen">
          {chosen.name} <span className="region">· {chosen.region}</span>
        </div>
      )}
      <form className="search-row" onSubmit={runSearch}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={S.searchPlaceholder}
        />
        <button type="submit" disabled={searching}>
          {searching ? S.searching : S.searchButton}
        </button>
      </form>
      {results && results.length === 0 && !searching && (
        <p className="setup-hint">{S.noResults}</p>
      )}
      {results && results.length > 0 && (
        <ul className="search-results">
          {results.map((r, i) => (
            <li key={i}>
              <button type="button" onClick={() => choose(r)}>
                {r.name} <span className="region">· {r.region}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {chosen && (
        <>
          <div className="setup-label">{S.facingLabel}</div>
          {guessing && <p className="setup-hint">{S.facingGuessing}</p>}
          <div className="facing-grid">
            {COMPASS.map((c) => (
              <button
                key={c.deg}
                type="button"
                className={facing === c.deg ? 'facing selected' : 'facing'}
                onClick={() => setFacing(c.deg)}
              >
                {c.label}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="setup-actions">
        <button
          className="setup-save"
          disabled={!canSave}
          onClick={() => onSave({ name: name.trim(), location: { ...chosen, facing } })}
        >
          {S.save}
        </button>
        {canCancel && (
          <button className="setup-cancel" type="button" onClick={onCancel}>
            {S.cancel}
          </button>
        )}
      </div>
    </div>
  )
}

// The 8 main winds for the facing picker (labels reuse the 16-wind names).
const COMPASS = Array.from({ length: 8 }, (_, i) => ({
  label: CONTENT.cardinals[i * 2],
  deg: i * 45,
}))

function Result({ conditions, result, name, onRefresh }) {
  const { verdict, factors, nextChange } = result
  // Keys of minimised factors the user has manually expanded this render.
  const [expanded, setExpanded] = useState(() => new Set())
  const toggle = (key) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })

  return (
    <>
      <section className={`verdict verdict-${verdict.level}`}>
        <h1>{fill(verdict.title, { name })}</h1>
        <p>{verdict.blurb}</p>
        <p className="next-change">
          {nextChange
            ? fill(CONTENT.nextChange[nextChange.direction], {
                emoji: RATING_EMOJI[nextChange.to],
                time: nextChange.label,
              })
            : CONTENT.nextChange.steady}
        </p>
        <p className="weather-now">
          {CONTENT.nowPrefix} {describeWeather(conditions.weatherCode)},{' '}
          {Math.round(conditions.airTempNow)}
          {CONTENT.factors.airTemp.unit}
        </p>
      </section>

      <section className="factors">
        {factors.map((f) =>
          f.minimised && !expanded.has(f.key) ? (
            <MinBox key={f.key} factor={f} onExpand={() => toggle(f.key)} />
          ) : (
            <FactorRow
              key={f.key}
              factor={f}
              collapsible={f.minimised}
              onCollapse={() => toggle(f.key)}
            />
          ),
        )}
      </section>

      <button className="refresh" onClick={onRefresh}>
        {CONTENT.status.refresh}
      </button>
    </>
  )
}

// A minimised factor: one compact, muted, clickable line that expands on tap.
function MinBox({ factor, onExpand }) {
  const note = CONTENT.factors[factor.key]?.minNote
  return (
    <button className="factor factor--min" onClick={onExpand} title={note}>
      <span className="factor-icon">{factor.icon}</span>
      <span className="factor-label">{factor.label}</span>
      <span className="min-note">{note}</span>
      <span className="min-chevron">{CONTENT.minExpand}</span>
    </button>
  )
}

function FactorRow({ factor: f, collapsible, onCollapse }) {
  const hasChart = f.series && f.series.length > 1
  return (
    <div className={`factor factor-${f.rating}${hasChart ? ' factor--chart' : ''}`}>
      <span className="factor-icon">{f.icon}</span>
      <span className="factor-label">
        {f.label}
        {collapsible && (
          <button className="min-collapse" onClick={onCollapse} aria-label="collapse">
            {CONTENT.minCollapse}
          </button>
        )}
      </span>
      <span className="factor-value">{f.display}</span>
      <span className="factor-rating">{RATING_EMOJI[f.rating]}</span>
      {hasChart && <Sparkline points={f.series} kind={f.chart} markers={f.markers} />}
    </div>
  )
}

// Tiny inline chart for a factor's rolling-window trend.
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

  // Measure the rendered chart width so label-overlap suppression works in
  // real pixels — narrow (mobile) charts drop more labels automatically.
  const wrapRef = useRef(null)
  const [wrapW, setWrapW] = useState(320)
  useEffect(() => {
    const el = wrapRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const update = () => {
      const width = el.getBoundingClientRect().width
      if (width) setWrapW(width)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const labelShown = visibleLabels(markers, wrapW)

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
    <span className="spark-wrap" ref={wrapRef}>
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

// Decide which marker labels to render. Each label's pixel extent is estimated
// from its text and the measured chart width (mirroring markerStyle's edge
// clamping), then walking left→right any label that would overlap the last
// kept one is dropped — so the first label of a cluster wins at every width.
const LABEL_CHAR_PX = 5.4 // ≈ average glyph width at the 9px label size
const LABEL_GAP_PX = 6
function visibleLabels(markers, widthPx) {
  const shown = new Set()
  const items = markers
    .map((m, i) => {
      const half = (`${markerPrefix(m)} ${m.label}`.length * LABEL_CHAR_PX) / 2
      const cx = Math.min(Math.max(m.xFrac * widthPx, half), widthPx - half)
      return { i, xFrac: m.xFrac, left: cx - half, right: cx + half }
    })
    .sort((a, b) => a.xFrac - b.xFrac)
  let lastRight = -Infinity
  for (const it of items) {
    if (it.left >= lastRight + LABEL_GAP_PX) {
      shown.add(it.i)
      lastRight = it.right
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
