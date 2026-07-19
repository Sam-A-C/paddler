// Location search and shore-facing estimation via Open-Meteo (free, no key).
import { CONTENT } from './content.js'

const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search'
const ELEVATION_URL = 'https://api.open-meteo.com/v1/elevation'

export async function searchLocations(query) {
  const url =
    `${GEOCODE_URL}?name=${encodeURIComponent(query)}` + `&count=8&language=en&format=json`
  const res = await fetch(url)
  if (!res.ok) throw new Error(CONTENT.status.error)
  const data = await res.json()
  return (data.results || []).map((r) => ({
    name: r.name,
    region: [r.admin1, r.country].filter(Boolean).join(', '),
    lat: r.latitude,
    lon: r.longitude,
  }))
}

// Guess which compass bearing the beach faces (looking out to sea) by sampling
// elevation on a ~2.5 km ring around it: sea cells report elevation <= 0, so
// the facing is the average direction of the seaward samples. Returns a bearing
// snapped to the 8 main winds (matching the setup picker), or null when the
// ring is ambiguous (all land or all sea).
export async function guessFacing(lat, lon) {
  const N = 16
  const km = 2.5
  const dLat = km / 111.32
  const dLon = km / (111.32 * Math.cos((lat * Math.PI) / 180))
  const lats = []
  const lons = []
  for (let i = 0; i < N; i++) {
    const rad = ((i * 360) / N) * (Math.PI / 180)
    lats.push((lat + dLat * Math.cos(rad)).toFixed(4))
    lons.push((lon + dLon * Math.sin(rad)).toFixed(4))
  }
  const res = await fetch(`${ELEVATION_URL}?latitude=${lats.join(',')}&longitude=${lons.join(',')}`)
  if (!res.ok) return null
  const { elevation } = await res.json()
  if (!Array.isArray(elevation) || elevation.length !== N) return null

  let x = 0
  let y = 0
  let sea = 0
  for (let i = 0; i < N; i++) {
    if (elevation[i] != null && elevation[i] <= 0) {
      const rad = ((i * 360) / N) * (Math.PI / 180)
      x += Math.sin(rad)
      y += Math.cos(rad)
      sea++
    }
  }
  if (sea === 0 || sea === N) return null
  const bearing = ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360
  return (Math.round(bearing / 45) % 8) * 45
}
