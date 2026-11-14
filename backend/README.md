# Rifzki Network Intelligence proxy

Module Worker: `rifzki-status-intelligence`. Public normalized endpoint:

`https://rifzki-status-intelligence.re-open.workers.dev/api/network-intelligence?region=ID`

Only ID and SG are accepted. GET/OPTIONS only; mutation methods, arbitrary target URLs, arbitrary query parameters and unrelated browser origins are rejected. The frontend origin and the local preview origin are allowed. The server fetches only fixed provider API paths and returns a branded field allowlist. Upstream JSON is bounded to 2 MiB. Public regional snapshots are cached for five minutes; tokens and raw errors never reach the response or logs. Logs/traces are enabled.

## Activate the data source

Add a valid read-only Radar API token as the Worker runtime secret `RADAR_API_TOKEN` using the provider dashboard. The existing SpeedTest runtime secret cannot be read back or copied through the connected API, and the candidate supplied during authoring was rejected. Never put the token in source, operations.json, a browser request, a preview, or a frontend variable. Without a valid secret, the endpoint returns HTTP 503 with `status: unconfigured` and null metrics, rather than a false healthy/zero result.

The frontend uses the configured proxy URL. For an alternative snapshot-only integration, clear the proxy URL in operations.json and the INTELLIGENCE_PROXY_URL repository variable, then set GitHub repository secret `RADAR_API_TOKEN`. This keeps the credential server-side and refreshes published snapshots. The normal proxy mode still requires its own runtime secret for browser refreshes.

## API coverage

- `/radar/annotations/outages` and `/radar/traffic_anomalies`
- `/radar/quality/speed/summary` and `/radar/quality/iqi/summary`
- `/radar/attacks/layer7/summary/mitigation_product`
- `/radar/bgp/leaks/events`
- `/radar/http/summary/http_version`, `/tls_version`, `/ip_version`

Requested abbreviated paths `/radar/quality/iqi`, `/radar/attacks/layer7/summary`, and `/radar/http/summary/` are constrained compatibility aliases for the normalized snapshot. They do not expose a generic authenticated proxy.

Source timestamps and data availability remain visible. A failed dataset is unknown. An active regional anomaly suggests correlation and never proves the cause of an application outage. Regional L7 mitigation mix is not a claim of Rifzki account protection. BGP queries are bounded and flagged partial when pagination is incomplete. TLS/HTTP/IPv6 percentages describe regional traffic, not an endpoint's negotiated protocol.

## Deploy updates

`backend/deployment.json` is the API metadata descriptor; source consists of worker.mjs and intelligence.mjs. All modules are uploaded atomically. Existing secret_text bindings are retained during updates.

The GitHub workflow `Rifzki Intelligence Backend` can be dispatched on master after setting repository variable `CLOUDFLARE_ACCOUNT_ID` and repository secret `CLOUDFLARE_API_TOKEN` with access to deploy this Worker in the correct account. That deployment credential is separate from the read-only Radar runtime token. The workflow never prints either value. A direct API deployment through the connected provider tool is also supported.

The static dashboard remains hosted on GitHub Pages; only the secret-bearing proxy runs on the Worker platform.
