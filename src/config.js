// Hardcoded location for now. Later this can become a selectable list.
export const LOCATION = {
  name: 'Worthing',
  region: 'West Sussex, UK',
  lat: 50.81,
  lon: -0.37,
}

// Thresholds used to rate each condition.
// Each factor rates GOOD when below `good`, OK when below `ok`, otherwise POOR.
// (For temperature, higher is better, so the comparison is inverted — see suitability.js.)
export const THRESHOLDS = {
  // Wind speed at 10m, km/h. Light wind is essential for safe, easy SUP.
  windSpeed: { good: 12, ok: 20, unit: 'km/h', higherIsBetter: false },
  // Significant wave height, metres. Flat water is best for paddle-boarding.
  waveHeight: { good: 0.3, ok: 0.6, unit: 'm', higherIsBetter: false },
  // Daily total precipitation, mm. Dry is nicer.
  rain: { good: 1, ok: 5, unit: 'mm', higherIsBetter: false },
  // Air temperature (daily max), °C. Warmer is more pleasant.
  airTemp: { good: 18, ok: 12, unit: '°C', higherIsBetter: true },
  // Sea surface temperature, °C. Colder water raises cold-shock risk.
  waterTemp: { good: 16, ok: 11, unit: '°C', higherIsBetter: true },
}
