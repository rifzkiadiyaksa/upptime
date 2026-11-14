# Rifzki public dashboard — review revision

The UI now has Overview, Services & Sites and History. Locations, geographic assets, Leaflet, PoP data, and the scheduled 30-country/infrastructure collection are removed from the frontend build. Overview retains the ID/SG Network Intelligence summary.

The active endpoint manifest and .upptimerc.yml both contain exactly 11 HTTPS endpoints. s3.rifzki.my.id and link.rifzki.my.id are excluded. Their old repository history is retained, but excluded from the active public archive and status model. Backend fixed-host infrastructure collection is also updated to exclude them.

## Reliability archive

Production status.json contains active reports and three recent headlines only. Full archived timelines are not shipped with initial dashboard data. Opening History fetches a small versioned calendar index and one static page containing at most eight reports. Previous/Next fetch only the requested page; date/month selection resets to page 1. Incidents crossing a UTC boundary appear in relevant periods. Maintenance shares pagination. Concurrent responses are guarded, twelve pages are cached in memory, empty periods and errors are distinct states, and stale index/page version mismatches are rejected. Every asset is served by GitHub Pages; visitors do not call GitHub or Worker APIs for history.

The standalone HTML export embeds archive assets solely for offline review. It is larger than the production dashboard and is not the production loading strategy. Use npm run preview for actual lazy-loading behavior.

## Blog investigation — 14 November 2026

The latest 15 blog incidents, including #1746 and #1743, all recorded HTTP 429 with short response times (258–677 ms), rather than timeout or HTTP 5xx. The Uptime CI job for run 43573614075 shows three consecutive HTTP 429 results for blog.rifzki.my.id after initial, +2 s and +10 s checks. Existing retries therefore did not resolve it.

Current independent checks from this workstation returned HTTP 200 for both curl and the Rifzki monitor user agent, with the actual Blogger page title Rifzki. DNS CNAME is ghs.google.com and the HTTP server reports GSE. These observations support Google/Blogger throttling of monitoring requests; they do not establish the exact blocking rule or prove every visitor was affected. Shared GitHub runner IP reputation is a plausible explanation, not a confirmed root rule. No 429 response has been whitelisted as healthy, no failure history erased, and no monitoring target quietly changed.

Evidence: https://github.com/rifzkiadiyaksa/upptime/issues/1746 , https://github.com/rifzkiadiyaksa/upptime/issues/1743 , https://github.com/rifzkiadiyaksa/upptime/actions/runs/43573614075 . Upptime v1.46.5 uses curl and the upptime.js.org user agent, and already confirms failed HTTP checks with retries: https://github.com/upptime/uptime-monitor/blob/v1.46.5/src/helpers/request.ts and src/update.ts.

## Validation and publication

Run npm ci, npm test and npm run build. Monitoring cadence remains five minutes and visible-tab dashboard refresh remains sixty seconds. All six languages and Arabic RTL remain supported. This revision is prepared for review before publication.
