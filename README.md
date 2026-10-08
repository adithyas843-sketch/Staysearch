# Cottage Finder

Searches the web for cottages in an area, reads each listing page, and keeps only private/standalone cottages.

## Run
1. `npm install`
2. Copy `.env.example` to `.env`, add `BRAVE_API_KEY` (and optionally `ANTHROPIC_API_KEY` for deep reading).
3. `node --env-file=.env server.js` then open http://localhost:3000

## Deploy
Any Node host works (Render, Railway, Fly.io). Set the same env vars there.

## How it works
1. `server.js` finds candidate pages with a search API.
2. Each page's text is fetched and scored by `scorer.js` (positive and negative phrases).
3. If `ANTHROPIC_API_KEY` is set, plausible listings are also read by Claude, which returns a verdict, a reason and the price.
4. Only cottages under your max price are returned, best match first.

## Limits
- Booking.com, Airbnb and MakeMyTrip often block automated page fetches and their terms restrict scraping. When blocked, the app falls back to the search snippet, which is less accurate. For reliable data from these sites, use their official partner/affiliate APIs and add a function next to `braveSearch` in `server.js`.
- Prices come from page text and may not match your dates. Always confirm on the booking site.
