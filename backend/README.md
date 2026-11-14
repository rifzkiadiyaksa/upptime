# Rifzki Network Intelligence backend

`worker.mjs` exposes fixed read-only routes; no arbitrary host, URL, ASN or IP input is accepted:

- `/api/network-intelligence?region=ID|SG`: regional aggregates, five major ISPs, actual ASN names and ASN-specific event/latency evidence.
- `/api/location-intelligence?region=CC`: four datasets for a fixed 30-country directory allowlist.
- `/api/infrastructure`: current public DNS edge ownership for the 13 configured service hosts, plus up to four ASN-specific speed/event queries. Registration country is not physical server location.

The existing compatibility aliases return normalized branded snapshots. Supported browsers retain exact-origin CORS; unknown methods, paths and query parameters are rejected. All upstream responses are bounded to 2 MiB, DNS queries use a fixed host allowlist, and every fetch has a timeout. Missing or malformed metrics stay null. A result cap makes event coverage partial, never conclusively clean.

Responses carry `Cache-Control: public, max-age=60, s-maxage=300, stale-while-revalidate=600`. The shared per-colo `caches.default` key ignores compatibility aliases and browser origins; only fixed route mode and allowed region affect it. Ready, partial and error/unconfigured snapshots are cached for five minutes. The dashboard itself reads GitHub Pages snapshots and never polls this Worker directly.

Secret `RADAR_API_TOKEN` is installed in the Worker only. Upload metadata retains `secret_text` bindings. `node backend/deploy.mjs` accepts `CLOUDFLARE_ACCOUNT_ID` and a separate deployment credential `CLOUDFLARE_API_TOKEN`; it never logs secret values. The manual backend workflow runs from master. No paid binding or paid plan is added. Cached API responses reduce upstream queries, but do not guarantee zero Worker invocations or enforce a global billing limit. See the frontend cost boundaries.

Country speed/IQI data is a published aggregate measurement, not a direct edge ping. ASN-specific active reports, country context and direct service checks are separate evidence. No lack of reports establishes that a route or network is 100% healthy.

