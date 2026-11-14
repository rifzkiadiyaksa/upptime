# Rifzki System Status

A static multi-tab status dashboard published by the existing GitHub Pages workflow. The public product is branded Rifzki. Footer text is exactly `Runs on the infrastructure of Rifzki Adiyaksa`.

## Local development

Use Node 22+: `npm ci`, `npm test`, `npm run build`, `npm run preview`.
Open http://127.0.0.1:4173. The build retrieves public incident records without credentials locally; CI uses `GITHUB_TOKEN`. API failures in CI fail the build instead of publishing a misleading empty incident history.

## Dashboard

- Overview: verified aggregate health, stale-data warning, incident timelines, component groups, maintenance and service-selectable latency overview.
- Services & Sites: grouped accordions, 30/60/90-day UTC availability, tap/hover/keyboard tooltips, TLS expiry, and per-service response charts with 24h/7d/30d/90d ranges.
- Locations: 39 locations reused from the user's SpeedTest directory, Leaflet map, theme-aware basemaps, region filters and selected-location cards.
- History: monthly calendar, day filters, incident timelines and full-report links.
- Light/dark themes, saved language preference (EN/ID), desktop pill tabs and an icon-only glass bottom dock at widths up to 768px. Brand logo and favicon are downloaded local SVG assets. The web manifest uses the local logo; no offline status caching is introduced.

## Data accuracy and limitations

Current status/check times come from `history/<slug>.yml`, aggregate availability and daily history from `history/summary.json`, and incident history from status-labeled GitHub issues. Data older than 30 minutes is marked unconfirmed. The snapshot includes up to 500 recently updated incidents plus open issues; use Full archive for older records. Legacy open incidents for removed services stay in History but are excluded from the active monitored-service count.

Daily downtime combines summary values with the union of recorded incident intervals. Open incident intervals stop at the last actual monitoring check; overlaps are not double-counted. Today and the first monitored day use only their observed minutes. A down endpoint with missing outage boundaries is unknown rather than green. The UI shows both day coverage and incident context in tooltips. Historical source summaries follow their existing update schedule.

Response charts use actual collected samples. `telemetry.json` is carried forward from the previous gh-pages snapshot, deduplicated by monitoring timestamp and retained for 90 days. Collection starts with the first custom dashboard deployment. Old chart images and aggregate response-time badges cannot produce true historical percentiles, so no backfilled curves are invented. P50 uses measured successful responses; P95 requires at least 20 samples and P99 at least 100. Failed checks are excluded from latency percentiles and represented in availability. Charts leave gaps between checks more than 20 minutes apart. These are HTTP/TCP response times from monitoring runners, not per-city ICMP pings.

SSL validity and certificate expiry are checked through validated TLS connections at build time. Timeout/network failures are unknown, not valid. Domain expiry has no existing source in this repository and stays unavailable unless a verified ISO date is supplied in operations.json. The SpeedTest location directory supplies city coordinates, not independently addressable regional probe endpoints. No city pings or rerouting statuses are fabricated.

## Operations configuration

Edit `frontend/operations.json` in GitHub:

- `maintenance`: entries `{id,title,start,end,services}`; start/end must be ISO datetimes, end after start, services are existing slugs. Active and upcoming windows drive banners, countdowns, affected component tags and blue daily bars. Past entries can be retained for historical maintenance coloring.
- `domainExpiry`: map a hostname to a verified ISO expiry date.
- `probes`: entries `{code,ping,routing,checkedAt}`. Code must match locations.json; ping is measured ms; routing is `Operational`, `Re-routed` or `Down`. A trusted external collector must populate this file; data older than 30 minutes is unconfirmed. This frontend does not deploy regional agents.
- `map.cartoApiKey`: optional public, origin-restricted CARTO basemap key, or set the repository variable `CARTO_API_KEY`. Theme switching selects dark_all/light_all. CARTO now requires an API key. Without one, the interactive map uses bundled Natural Earth geometry, with all city markers and filters still working. Required map data attribution is retained; it is not platform branding.

Subscription opens the repository's existing GitHub watch preferences; no email signup service or invented subscription backend is introduced.

## Deployment and maintenance

Rifzki Status CI tests and builds on PRs but publishes only from master, through the existing gh-pages branch and domain CNAME. GitHub App / GH_PAT / GITHUB_TOKEN deployment authentication is retained. It runs after monitoring/summary runs, source and issue changes, and every five minutes (GitHub scheduling may be delayed). Frontend concurrency is separate from the monitoring queue.

Upptime checks, response tracking, summaries, graphs and notifications stay in GitHub. Automatic upstream template generation remains disabled in favor of manual review because it would overwrite site.yml and restore the legacy Sapper publishing step in setup.yml. Review upstream updates on a branch and retain this deployment boundary.

## Assets and validation

Local brand asset source: https://ik.imagekit.io/1999/CDN/img/Logo_Web.svg (logo.svg and favicon.svg).
Location directory source: rifzkiadiyaksa/speedtest, src/lib/server-locations.ts (the directory only; no private configuration or secrets are copied).
Local land geometry: Natural Earth 1:110m land, public-domain source https://github.com/nvkelso/natural-earth-vector. Leaflet's license is included in dist/vendor. CARTO/OpenStreetMap credit remains visible when their tiles are used.

Validation includes model tests for UTC downtime, partial-day coverage, overlap union, missing boundaries, stale checks, sample retention, percentiles and maintenance scope. Browser checks cover desktop/mobile themes and tabs, no horizontal overflow, day tooltips, graph controls, map selection and filters, calendar filtering, language toggle and subscription modal.
