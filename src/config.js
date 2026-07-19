// Default location, used to pre-fill first-run setup. The active location
// (with the user's name) lives in localStorage — see prefs in App.jsx.
// `facing` = compass bearing the beach looks out to sea (Worthing faces ~south).
export const DEFAULT_LOCATION = {
  name: 'Worthing',
  region: 'West Sussex, UK',
  lat: 50.81,
  lon: -0.37,
  facing: 180,
}

// Thresholds used to rate each condition.
// Each factor rates GOOD when below `good`, OK when below `ok`, otherwise POOR.
// (For temperature, higher is better, so the comparison is inverted — see suitability.js.)
export const THRESHOLDS = {
  // Wind speed at 10m, km/h. Light wind is essential for safe, easy SUP.
  windSpeed: { good: 12, ok: 20, unit: 'km/h', higherIsBetter: false },
  // Significant wave height, metres. Flat water is best for paddle-boarding.
  waveHeight: { good: 0.3, ok: 0.6, unit: 'm', higherIsBetter: false },
  // Air temperature (current), °C. Warmer is more pleasant.
  airTemp: { good: 18, ok: 12, unit: '°C', higherIsBetter: true },
  // Sea surface temperature, °C. Colder water raises cold-shock risk.
  waterTemp: { good: 16, ok: 11, unit: '°C', higherIsBetter: true },
}

// Wind direction is rated on "offshore-ness": the angular distance (degrees)
// between where the wind blows from and the beach's seaward facing.
// 0 = pure onshore (from the sea), 180 = pure offshore (blows you out to sea).
export const WIND_DIR_BANDS = { onshoreMax: 67.5, crossMax: 112.5 }

// Tide is rated green within this many minutes of a high tide, red otherwise.
export const TIDE_GREEN_WINDOW_MIN = 120

// Rain is a simple dry/wet call: an hour with at least this much rain (mm)
// counts as wet (red), otherwise dry (green).
export const RAIN_WET_MM = 0.1

// Charts cover a rolling window of this many hours from now.
export const CHART_WINDOW_HOURS = 12
