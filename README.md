# Road to Austin

A family-friendly Formula 1 companion for following the 2026 season on the way
to the United States Grand Prix at Circuit of the Americas.

Public site:
https://road-to-austin-f1-2026.vercel.app

## What is included

- Race-by-race Road to Austin check-ins
- Driver and team championship competition
- Team technical choices and engine partnerships
- Teammate performance comparisons
- Beginner-friendly F1 explanations
- Austin circuit and race-day guides
- Device-local predictions, theme choice, and imported data
- Drag-and-drop updates using the supplied F1 JSON format
- Downloadable presenter guide
- Family prediction groups, private pre-race picks, scoring, and leaderboards

## Deploy on Vercel

1. Import this repository into Vercel.
2. Open **Storage** in the Vercel project and add a Neon Postgres database. This supplies `DATABASE_URL`.
3. Add a secret environment variable named `SESSION_SECRET` with a long random value.
4. Redeploy. The first Family Challenge request creates its database tables automatically.

The game uses a signed browser-based player identity. Family members join with
the private six-character family code; no Supabase account is required.

## Run locally

Requirements:

- Node.js 22.13 or newer
- npm

From the project folder:

```bash
npm install
npm run dev
```

Then open the local address shown in the terminal.

To validate the Vercel production build:

```bash
npm run build:vercel
```

## Project structure

- `app/page.tsx` - content, calculations, and interactions
- `app/globals.css` - responsive visual design and themes
- `app/layout.tsx` - page metadata and social sharing information
- `public/f1-2026-data.json` - default season dataset
- `public/road-to-austin-presenter-guide.pdf` - demo script
- `tools/build_presenter_guide.py` - regenerates the presenter guide

## Update the season data

The published app accepts a replacement JSON file through its drag-and-drop
update area. The file must preserve the same major sections as
`public/f1-2026-data.json`, including `calendar`, `drivers`, `teams`,
`tracks`, and `raceResults`.

The app derives driver standings, team standings, round-by-round team scores,
championship gaps, and teammate contributions from the confirmed results. It
does not invent missing qualifying, tire, pit-stop, or starting-grid data.

To change the default dataset for a new deployment, replace
`public/f1-2026-data.json` and rebuild the site.

## Data and privacy

Theme choice and imported JSON stay in the visitor's browser. Shared Family
Challenge groups and predictions are stored in Postgres. A signed, HTTP-only
cookie remembers each player; no email address or password is collected.
