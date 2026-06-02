# LPL Observability-as-Code — Phase 2 POC

Self-service **Dynatrace instrumentation** for development teams. A dev fills a form; a governed
GitHub PR deploys a **custom service + custom alert** as code through a pipeline. Built by Softility
as the demonstrable slice of the engagement's Phase 2 OaC pipeline — and an accelerator for the
data-center migration, since every migrated service can self-instrument in minutes.

```
  Dev team ──> Web form ──> Submission handler ──> GitHub PR ──> GitHub Actions ──> Dynatrace
                            (validate vs LPL        (review +      (syntax→tags→     (custom service
                             benchmark, render       approve)       benchmark→        + alert live)
                             Monaco config)                         dry-run→deploy)
```

## Quick start (local, no cloud needed)

```bash
cd server && npm install
DRY_RUN=1 npm start          # open http://localhost:8080
```

Submit the form — you'll see the exact Monaco config that *would* be committed. Set `GITHUB_TOKEN`
and `GITHUB_REPOSITORY` to open real PRs instead of dry-running.

## On an EC2 box (the real demo)

See **[docs/RUNBOOK.md](docs/RUNBOOK.md)** — provisioning, installs (Node, Monaco, OneAgent, Claude
Code), permissions/secrets, and the end-to-end run. Claude Code on the box reads **[CLAUDE.md](CLAUDE.md)**
for full project context.

## What gets deployed per request

A custom service detection rule, a metric-event alert (threshold from the form, mapped severity), an
alerting profile filtered to the team, and an auto-tag stamping `lpl.managed-by=observability-as-code`.
All as version-controlled Monaco v2 config — auditable, reproducible, governed.

> The Monaco JSON templates are realistic scaffolds. Verify them against your live tenant with
> `monaco download` before depending on a clean deploy — see CLAUDE.md › "Schema truth".
