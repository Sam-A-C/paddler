// All user-facing text in one place — edit here to reword the app.
// (Location lives in config.js; the page <title> and meta are in index.html.)

export const CONTENT = {
  brand: '🏄 Paddler',

  status: {
    loading: 'Checking the sea…',
    retry: 'Try again',
    refresh: '↻ Refresh',
    error: 'Weather service is unavailable right now. Please try again.',
  },

  // Prefix before the live "now" conditions line, e.g. "Right now: Overcast, 18°C".
  nowPrefix: 'Right now:',

  footer: {
    before: 'Data from ',
    linkText: 'Open-Meteo',
    linkUrl: 'https://open-meteo.com',
    after: '. Always check local conditions and your own ability before paddling.',
  },

  // Overall verdict, keyed by the worst factor rating.
  verdicts: {
    poor: {
      title: 'Not right now Giù',
      blurb: 'Conditions look unfavourable for sea paddle-boarding today.',
    },
    ok: {
      title: 'Doable — take care Giù',
      blurb: 'It could work, but conditions are marginal. Check locally before heading out.',
    },
    good: {
      title: 'Great time to paddle Giù!',
      blurb: 'Conditions look good for getting out on the water.',
    },
  },

  // Per-factor label, icon and unit. Tide adds rising/falling trend arrows.
  factors: {
    wind: { label: 'Wind', icon: '💨', unit: 'km/h' },
    waves: { label: 'Waves', icon: '🌊', unit: 'm' },
    airTemp: { label: 'Air temp', icon: '🌡️', unit: '°C' },
    waterTemp: { label: 'Sea temp', icon: '🐟', unit: '°C' },
    rain: { label: 'Rain', icon: '🌧️', unit: 'mm/h' },
    tide: { label: 'Tide', icon: '🌒', unit: 'm', rising: '↑', falling: '↓' },
  },

  // Rating badge shown on each factor row.
  ratingEmoji: {
    good: '✅',
    ok: '⚠️',
    poor: '❌',
  },

  // Chart marker glyphs: high/low tide, and "rating changes into…" callouts.
  markers: {
    high: 'H',
    low: 'L',
    becomesGood: '✓',
    becomesOk: '~',
    becomesPoor: '✗',
  },

  // WMO weather-code descriptions (see describeWeather in weather.js).
  weather: {
    unknown: 'Unknown',
    clear: 'Clear sky',
    mostlySunny: 'Mostly sunny',
    overcast: 'Overcast',
    fog: 'Foggy',
    drizzle: 'Drizzle',
    rain: 'Rain',
    snow: 'Snow',
    rainShowers: 'Rain showers',
    snowShowers: 'Snow showers',
    thunderstorm: 'Thunderstorm',
  },
}
