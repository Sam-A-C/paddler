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
  // {name} is replaced with the saved user name.
  verdicts: {
    poor: {
      title: 'Not right now {name}',
      blurb: 'Conditions look unfavourable for sea paddle-boarding today.',
    },
    ok: {
      title: 'Doable — take care {name}',
      blurb: 'It could work, but conditions are marginal. Check locally before heading out.',
    },
    good: {
      title: 'Great time to paddle {name}!',
      blurb: 'Conditions look good for getting out on the water.',
    },
  },

  // "Next status change" line under the verdict. {emoji} = the rating it
  // changes to, {time} = when.
  nextChange: {
    improves: 'Improving to {emoji} at {time}',
    worsens: 'Turning {emoji} at {time}',
    steady: 'No change expected in the next 12 hours',
  },

  // Per-factor label, icon and unit. Tide adds rising/falling trend arrows.
  // `minNote` is the hint shown when a factor is minimised to a compact box.
  factors: {
    wind: { label: 'Wind', icon: '💨', unit: 'km/h' },
    windDir: { label: 'Wind dir', icon: '🧭', minNote: 'only matters in marginal wind' },
    waves: { label: 'Waves', icon: '🌊', unit: 'm' },
    airTemp: { label: 'Air temp', icon: '🌡️', unit: '°C' },
    waterTemp: { label: 'Sea temp', icon: '🐟', unit: '°C' },
    rain: { label: 'Rain', icon: '🌧️', unit: 'mm/h' },
    tide: {
      label: 'Tide',
      icon: '🌒',
      unit: 'm',
      rising: '↑',
      falling: '↓',
      minNote: 'little tidal range here',
    },
  },

  // Affordances on a minimised box.
  minExpand: '▾',
  minCollapse: '▴',

  // Wind direction words, keyed by its rating (onshore good … offshore poor).
  windWords: {
    good: 'onshore',
    ok: 'cross-shore',
    poor: 'offshore',
  },

  // 16-wind compass names, clockwise from north.
  cardinals: [
    'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
    'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
  ],

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

  // First-run setup & location picker.
  setup: {
    intro: 'Tell us who you are and where you paddle.',
    nameLabel: "What's your name?",
    namePlaceholder: 'Your name',
    beachLabel: 'Your beach',
    searchPlaceholder: 'Search for another beach…',
    searchButton: 'Search',
    searching: 'Searching…',
    noResults: 'No places found — try another name.',
    facingLabel: 'Which way does the beach face (looking out to sea)?',
    facingGuessing: 'Estimating from the coastline…',
    save: "Let's paddle",
    cancel: 'Cancel',
    noSea: "Couldn't find sea data there — try a coastal spot.",
  },

  // Top-right reset button (clears saved name & beach).
  reset: '↺',
  resetTitle: 'Change name or beach',

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
