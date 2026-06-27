# 🏄 Paddler

A simple web app that tells you whether **today is suitable for sea paddle-boarding**.

Currently hardcoded to **Worthing, West Sussex (UK)**. Location will become selectable
in a future version — it's already isolated in [`src/config.js`](src/config.js) to make
that easy.

## How it decides

It pulls live conditions from the free [Open-Meteo](https://open-meteo.com) APIs (no API
key required) and rates five factors plus tide:

| Factor    | ✅ Good   | ⚠️ Marginal | Source                |
| --------- | --------- | ----------- | --------------------- |
| Wind      | < 12 km/h | < 20 km/h   | Forecast API          |
| Waves     | < 0.3 m   | < 0.6 m     | Marine API            |
| Air temp  | ≥ 18 °C   | ≥ 12 °C     | Forecast API (daily max) |
| Sea temp  | ≥ 16 °C   | ≥ 11 °C     | Marine API            |
| Rain      | < 1 mm    | < 5 mm      | Forecast API (daily sum) |
| Tide      | shown for context (trend + next high/low) | — | Marine API |

The overall verdict is the **worst** of the five rated factors. Thresholds live in
[`src/config.js`](src/config.js) — tweak them to taste.

> ⚠️ This is a guide only. Always check local conditions, tide tables, and your own
> ability before going out on the water.

## Run locally

```bash
npm install
npm run dev
```

Then open the URL Vite prints (usually http://localhost:5173).

## Build

```bash
npm run build      # outputs to dist/
npm run preview    # preview the production build
```

## Deploy (GitHub → Render)

1. Push this repo to GitHub.
2. In [Render](https://render.com): **New + → Blueprint**, connect the repo. The included
   [`render.yaml`](render.yaml) configures a static site:
   - Build: `npm install && npm run build`
   - Publish dir: `dist`
3. Render builds and gives you a public URL. Every push to the default branch redeploys.

(No environment variables or secrets needed — the weather APIs are public.)

## Tech

React 18 + Vite. No backend; all data is fetched client-side.
