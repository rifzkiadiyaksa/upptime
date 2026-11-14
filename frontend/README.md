# Rifzki status dashboard

The public UI is a static GitHub Pages application. Monitoring and snapshot builds run in GitHub Actions every five minutes; visible dashboard tabs revalidate static JSON every 60 seconds. Hidden tabs do not poll. No visitor-triggered Radar, SSL scanner or GitHub API calls are made.

## Languages

Every navigation load starts with `en-US`, regardless of browser language or older local-storage preferences. The selector offers en-US, id-ID, zh-CN, ko-KR, th-TH and ar-SA. Arabic sets `dir=rtl`. `catalog.mjs` holds six-column phrase translations, including dynamic placeholders. `i18n.mjs` translates text and accessible names on newly rendered cards, dialogs, tooltips and map popups, preserves source text on language changes and formats calendar weekdays. Dates use the selected locale and UTC. Domains, codes, protocol names, ASN organization names and quoted source incident prose remain source evidence, rather than machine-generated translations.

There is no subscription UI or subscription event handler.

## Locations and networks

The 39 coordinates come from the existing SpeedTest directory. `countryCode` associates each with a country snapshot, rather than inventing a city-level latency measurement. No extra SJC PoP is asserted without source evidence.

Server-location cards show country RTT, jitter and IQI latency from Radar, the dataset measurement window, snapshot time and a separate direct PoP ping/jitter. Those direct fields remain unavailable until independent probes are supplied in `operations.json`. Radar Speed summary is an aggregate dataset (currently a 90-day window), not a live ping. A fresh API retrieval does not make the underlying dataset instantaneous.

The ASN view queries five population-ranked ISPs in each of ID/SG, ASN-specific speed summaries and ASN-specific outage/anomaly reports. Infrastructure edge ASNs are discovered by resolving the 13 fixed service hostnames and looking up their current public IPs. Only four infrastructure networks are expanded per snapshot to keep a strict request budget; a truncated inventory is flagged. DNS edge ownership is not proof of origin hosting or physical PoP location. ASN registry country is not an inferred city. ASN names are shown accurately, including upstream organizations.

Country markers and cards share the same event classifier. ASN mode uses country-scoped ISP reports or explicitly located infrastructure events. Red/amber pulsation means an active outage/anomaly report; gray means unavailable or incomplete evidence; green means no active event reported in the queried datasets. It never means guaranteed 100% health. Missing, future, stale (>15 minutes) and capped event evidence cannot become a verified clean location.

## Build and checks

`npm ci`, `npm test`, `npm run build`, `npm run preview`.

The build reads the existing secret-bearing proxy in `operations.json`, collects bounded country, ISP and infrastructure snapshots, and writes only public data to `dist/status.json`. The proxy URL and credentials are not sent to the browser. Security checks continue to run once per scheduled build, outside visitor requests. Existing certificate-matched full-grade scanner configuration remains optional; absent grades stay unverified.

Changes are published together in one source commit. The frontend workflow has no issue/workflow-completion fan-out, so a monitor incident cannot start extra redundant frontend builds. Existing 5-minute monitoring is unchanged.

## Cost boundaries

No paid services, bindings, queues, databases, scanners or new dependencies are introduced. Expected collection is 33 Worker invocations per scheduled build (2 regional, 30 country, 1 infrastructure), about 9,504/day at an uninterrupted five-minute schedule, independent of visitor count. Each invocation is bounded below 50 upstream subrequests. Worker cache TTL is 300 seconds, with response `s-maxage=300, stale-while-revalidate=600`; failures are cached too. Cache is per edge location, not a globally shared quota counter. Cold misses or deliberate requests to the public proxy can still invoke the Worker.

A cache is not a billing cap. Cloudflare subscription details were unavailable to the connected account, so this code cannot certify that the account is on Workers Free, or guarantee zero cost for all traffic. Verify the Workers account plan and usage in the dashboard before interpreting this as a billing guarantee. No paid plan was enabled or changed. Free tier excess can make telemetry unavailable; that should remain an explicit unavailable state.

Official references: https://developers.cloudflare.com/workers/platform/limits/ and https://docs.github.com/en/actions/concepts/billing-and-usage. Standard hosted Actions runners in this public repository are free. CARTO tiles remain optional behind the existing key; the bundled local geographic map is the default with no external tile charge.

