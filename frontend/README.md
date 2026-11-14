# Rifzki System Status

Static public dashboard, GitHub monitoring configuration, scheduled security inspection and a credential-protecting regional telemetry proxy.

## Monitored services

Exactly 13 HTTPS roots, in the requested order and groups:

| Group | Hosts |
| --- | --- |
| Dashboard & Core App | rifzki.my.id, laci.rifzki.my.id, link.rifzki.my.id, s.rifzki.my.id, s3.rifzki.my.id |
| Public Service & App | ai.rifzki.my.id, blog.rifzki.my.id, jejak.rifzki.my.id, meet.rifzki.my.id, speed.rifzki.my.id, webmail.rifzki.my.id |
| Hosting App | cpanel.rifzki.my.id, panel.rifzki.my.id |

`.upptimerc.yml` controls the engine; `frontend/endpoints.json` controls public grouping. Tests require both lists to match exactly. Removed services are excluded from public data, charts, incident archives and active counts. Historical repository records are retained without continuing to monitor removed endpoints. Existing root/blog slugs retain their actual history. New services start without invented uptime history.

A root HTTP status outside 200–399 is a failed application check. In the authoring inspection, s3.rifzki.my.id returned 404. A different known health-check path or an intentional status-code policy must be explicitly configured before treating that response as healthy.

## Running locally

Node 22+: `npm ci`, `npm test`, `npm run build`, `npm run preview`. Open http://127.0.0.1:4173.

Build checks each of the 13 endpoints with bounded TLS, HTTP/HTTPS, DNS and security.txt requests. Status and latency are measured from these actual requests. Engine history/summary files supply historical context; an absent history file produces unknown historical bars. Telemetry samples are retained from the prior gh-pages snapshot for 90 days and deduplicated by check timestamp. The latest actual inspection supplies current status; checks older than 30 minutes are unconfirmed.

The frontend remains on GitHub Pages. Monitoring/build schedule is five minutes; the browser checks for updates every 60 seconds while visible and not interacting with open details. No 30-second process was introduced. GitHub schedules may be delayed.

## Security inspection and score

`frontend/inspect.mjs` performs the checks. `frontend/security-model.mjs` evaluates evidence, and every service's score badge opens its grouped detail panel. Each verified pass earns one point out of ten:

1. A verified HTTPS response (an HTTP error can still prove HTTPS reachability while failing application uptime).
2. A current certificate-matched A/B grade assessment plus locally validated strong TLS.
3. An enforcing HSTS max-age greater than zero.
4. An enforcing CSP header; report-only does not count.
5. Frame protection plus nosniff; a wildcard frame-ancestors policy does not pass.
6. DNSSEC authenticated DNS response validation (AD), not just a DNSKEY lookup.
7. An AAAA record and an actual IPv6 HTTPS response. A runner without an IPv6 route produces unknown, not a confirmed endpoint failure.
8. SPF at the exact hostname. Parent SPF is never assumed to apply to a subdomain.
9. A valid DMARC record, with organizational-domain fallback only when the exact subdomain has no DMARC record. Duplicate/invalid records do not earn a point.
10. A public text/plain security.txt with Contact and a future Expires date; SPA HTML fallback pages do not pass.

Unknown checks are never passed or silently normalized into a perfect score. A partial score is explicitly labeled with its unknown count. Colors are used only when the possible score range is in one band: at least 8 verified points is green, fewer than 5 possible points is red, an entirely 5–7 range is amber; uncertain cross-band results are muted.

Certificate validity, expiry and issuer are obtained from validated TLS. HTTP/2 refers to an actually negotiated ALPN capability. HTTP/3 is shown only as advertised unless a completed measurement exists. A single TLS handshake cannot establish a full SSL grade. To supply a grade, configure `SSL_ASSESSMENT_URL` (repository variable) and optional `SSL_ASSESSMENT_TOKEN` (secret) for a trusted HTTPS assessment service returning `{host,grade,fingerprint,checkedAt}`. The fingerprint must match the current certificate and the assessment must be less than 24 hours old. Missing assessments remain unknown. No A/A+ grade is fabricated.

This score is a transparent checklist, not a claim that a service is immune to attacks. Regional threat metrics are not used as proof of account-level protection.

## Regional intelligence

See `backend/README.md`. The frontend can use `INTELLIGENCE_PROXY_URL` (repository variable) or the configured URL in operations.json. A read-only Radar credential stays only in the proxy's `RADAR_API_TOKEN` secret; it never enters frontend source, public JSON, logs or the preview. The token value offered during authoring was rejected by the API and was not saved to this repository.

The deployed proxy is prepared at https://rifzki-status-intelligence.re-open.workers.dev/api/network-intelligence and deliberately returns an explicit unconfigured state until a valid runtime secret is installed. It covers ID/SG outages/anomalies, speed/IQI latency, L7 attack mitigation mix, regional BGP leaks and HTTP/3/TLS 1.3/IPv6 adoption. Regional events are possible correlation evidence, not proof of an ISP causing a Rifzki outage. Network RTT and application response time are labeled as different measurements. Radar regional data cannot assert account-specific DDoS protection or the health of a specific route.

## UI, locations, maintenance and history

The four tabs are Overview, Services & Sites, Locations and History. Dark/light themes, EN/ID selection, desktop pill tabs and an icon-only glass bottom dock at widths up to 768px remain. Logo/favicon/PWA icons are local SVG assets downloaded from the requested URL. Footer text is exactly `Runs on the infrastructure of Rifzki Adiyaksa`.

Service bars support 30/60/90 days, and their bounded floating tooltips show actual observed coverage, downtime and incident context. Overlapping incident intervals are unioned; today's availability is clipped to observed minutes. A selected-period percentage is weighted by actual observed minutes, excluding unknown history. Charts support 24h/7d/30d/90d, leave gaps rather than interpolate missing observations, and require 20/100 valid samples for p95/p99.

`frontend/operations.json` supports:

- `maintenance`: `{id,title,start,end,services}` windows, with ISO times and endpoint slugs. Windows drive countdowns, affected components, historical blue bars, calendar markers and a monthly maintenance log.
- `probes`: verified `{code,ping,routing,checkedAt}` records, populated by a trusted regional probe collector. Old records become unconfirmed after 30 minutes.
- `map.cartoApiKey` or repository variable `CARTO_API_KEY`: a public origin-restricted basemap key. Theme selects dark_all/light_all. Without one, bundled Natural Earth geography keeps the Leaflet map interactive.
- `intelligence.proxyUrl`: public proxy URL, with fixed ID/SG regions.

The 39 city coordinates are reused from the actual SpeedTest directory. That directory does not provide independent per-city probe targets. No city ping, route change or unverified Edge PoP is invented; a requested example such as SJC must be backed by a real location/probe source before being claimed as an active PoP. Required geographic attribution is retained.

Incident snapshots contain up to 500 recent status issues plus open reports, filtered to the 13 monitored services. A full archive link remains available for older records. Subscription opens existing GitHub watch preferences; no email delivery backend is invented.

## Deployment boundary and validation

Rifzki Status CI tests PRs and publishes only on master to the existing gh-pages branch and CNAME. Setup CI cannot regenerate workflow templates or publish the legacy UI; template upgrades are reviewed manually. The separate `Rifzki Intelligence Backend` workflow deploys backend modules only on manual dispatch from master and preserves existing secret bindings. Source changes are prepared locally and pushed in one atomic commit.

Validation covers exact endpoint/group membership, observed downtime, stale data, score evidence, unknown handling, certificate-grade freshness, DNS/email policy parsing, security.txt validation, proxy input/CORS restrictions, missing telemetry and the custom deployment boundary. Browser QA checks the actual 13-service list, grouped security report, both themes, mobile dock, tooltips, regional widgets and history.

To export a standalone snapshot for review: `node frontend/export-preview.mjs /absolute/path/preview.html`. The export embeds the logo, measured data, map geometry and scripts and clearly labels itself as a frozen snapshot.
