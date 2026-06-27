import { useEffect, useState } from 'react'
import { LOCATION } from './config.js'
import { fetchConditions, describeWeather } from './weather.js'
import { evaluate } from './suitability.js'

const RATING_EMOJI = { good: '✅', ok: '⚠️', poor: '❌' }

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
          <div className="brand">🏄 Paddler</div>
          <div className="location">
            {LOCATION.name} <span className="region">· {LOCATION.region}</span>
          </div>
          <div className="date">{today}</div>
        </header>

        {state.status === 'loading' && (
          <p className="status">Checking the sea…</p>
        )}

        {state.status === 'error' && (
          <div className="status error">
            <p>{state.message}</p>
            <button onClick={load}>Try again</button>
          </div>
        )}

        {state.status === 'ready' && (
          <Result conditions={state.conditions} result={state.result} onRefresh={load} />
        )}
      </main>
      <footer className="footer">
        Data from{' '}
        <a href="https://open-meteo.com" target="_blank" rel="noreferrer">
          Open-Meteo
        </a>
        . Always check local conditions and your own ability before paddling.
      </footer>
    </div>
  )
}

function Result({ conditions, result, onRefresh }) {
  const { verdict, factors, tideTimes } = result
  return (
    <>
      <section className={`verdict verdict-${verdict.level}`}>
        <h1>{verdict.title}</h1>
        <p>{verdict.blurb}</p>
        <p className="weather-now">
          Right now: {describeWeather(conditions.weatherCode)},{' '}
          {Math.round(conditions.airTempNow)}°C
        </p>
      </section>

      <section className="factors">
        {factors.map((f) => (
          <div key={f.key} className={`factor factor-${f.rating}`}>
            <span className="factor-icon">{f.icon}</span>
            <span className="factor-label">{f.label}</span>
            <span className="factor-value">{f.display}</span>
            <span className="factor-rating">{RATING_EMOJI[f.rating]}</span>
          </div>
        ))}
      </section>

      {tideTimes && (tideTimes.nextHigh || tideTimes.nextLow) && (
        <p className="tide-times">
          {tideTimes.nextHigh && <>Next high {tideTimes.nextHigh}</>}
          {tideTimes.nextHigh && tideTimes.nextLow && '  ·  '}
          {tideTimes.nextLow && <>Next low {tideTimes.nextLow}</>}
        </p>
      )}

      <button className="refresh" onClick={onRefresh}>
        ↻ Refresh
      </button>
    </>
  )
}
