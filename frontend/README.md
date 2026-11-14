# Rifzki status frontend

Custom static status page, inspired by the clarity of modern status pages. Public branding is Rifzki. The footer reads “Runs on the infrastructure of **Rifzki Adiyaksa**.”

## Architecture

- `.upptimerc.yml` remains the monitoring configuration and domain source.
- `history/<slug>.yml` provides current status, check time and monitoring start time.
- `history/summary.json` provides historical daily downtime and aggregate availability. These summaries follow Upptime's existing update schedule; they are not live samples.
- CI fetches up to 100 recently updated issues labeled `status` for the incident archive. The complete archive remains linked on GitHub. No visitor-side GitHub API calls or credentials.
- `npm run build` writes static assets and `status.json` into `dist/`, including the existing custom-domain CNAME.
- `Rifzki Status CI` runs after monitoring workflows, incident changes, source changes and on a five-minute schedule. GitHub schedules may be delayed. The browser refreshes the published snapshot every minute and marks checks older than 30 minutes as unconfirmed.
- The workflow retains the existing GitHub App / GH_PAT / GITHUB_TOKEN deployment authentication. GitHub Pages continues serving the `gh-pages` branch. No Pages settings migration is required.

## Local use

Use Node 22 or newer: `npm ci`, `npm test`, `npm run build`, `npm run preview`. Open http://127.0.0.1:4173.

For authenticated incident retrieval, provide `GITHUB_TOKEN` as an environment variable with repository issues read access. Without it the local build deliberately shows incident history as unavailable, rather than inventing an empty history. CI provides this token automatically.

## Upptime template maintenance

Automatic template regeneration has been replaced by manual review because it overwrites `site.yml` and restores the original Sapper deployment in `setup.yml`. Uptime checks, response time tracking, summaries, graphs, notifications and incidents continue using their existing workflows. The workflow named `Review Upptime Template Updates` explains this boundary without rewriting files.

When upgrading Upptime, review upstream workflow changes and action versions manually. Preserve the custom `site.yml`, the removal of legacy publishing from `setup.yml`, and the manual template-update boundary. Do not run upstream `update-template` directly against the default branch. Review updates on a separate branch first.

## Validation and release

`npm test` checks UTC availability history, no-data ranges, stale status and overall health aggregation. `npm run build` verifies source data and produces deployable static files. PRs build and test without deployment; merging to `master` publishes the new UI through the existing gh-pages flow.

Browser visual review is still needed before release: the in-app browser timed out in the authoring environment. Review desktop and mobile layout, the 30/90-day selector, daily tooltips, refresh, incident pagination and footer. Source includes responsive CSS but this is not a claim of completed visual QA.
