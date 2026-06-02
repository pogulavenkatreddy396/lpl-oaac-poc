# CLAUDE.md — project context for Claude Code

You are working on the **LPL Observability-as-Code (OaC) Phase 2 POC** for Softility.
This file is auto-loaded when Claude Code runs in this repo. Read it before acting.

## What this POC is

A dev team fills a **web form** → the submission is validated against the LPL benchmark →
a **custom Dynatrace service + custom alert** are rendered as Monaco config → committed via a
**GitHub PR** → the **GitHub Actions pipeline** validates and deploys them to Dynatrace on merge.
It is the demonstrable slice of the Phase 2 "OaC pipeline" from the engagement reports, and a
direct accelerator for the data-center migration (every migrated service self-instruments).

Architecture: **Approach A (GitOps)**. Form platform: standalone webform. CI: **GitHub Actions**.
Sample app: **Node.js**. Target: a **Dynatrace 15-day free trial** tenant (full write access).

## Repo map

- `form/index.html` — branded intake form; self-populates dropdowns from `/api/benchmark`.
- `server/` — Node/Express submission handler.
  - `lib/benchmark.js` + `benchmark/lpl-benchmark.json` — the **gate**: allowed tech, tag taxonomy, severity model, SLI/threshold rules.
  - `lib/monacoMapper.js` — renders the four config templates per submission.
  - `lib/github.js` — opens the branch + PR (Octokit, Contents API).
- `monaco/` — Monaco v2 project.
  - `manifest.yaml` — targets the trial tenant via `DT_ENV_URL` / `DT_API_TOKEN`.
  - `_templates/` — token templates (`{{...}}`) the mapper fills.
  - `projects/lpl-observability/services/<id>/` — one folder per instrumented service (PR adds these). A worked example `clientworks-trading-api` is committed.
- `sample-app/` — Node.js service to instrument with OneAgent; `/load` drives traffic, `/load?slow=1` / `?error=1` trip the alert.
- `.github/workflows/deploy.yml` — 5 stages: syntax → tags → benchmark → staging dry-run → deploy.
- `scripts/` — `bootstrap-ec2.sh`, `push-to-github.sh`, `deploy-monaco.sh`, `ci-validate.js`, `gen-example.js`.
- `docs/RUNBOOK.md` — full EC2 setup. Follow it for provisioning/install/permissions.

## Schema truth (IMPORTANT — do this first against the live tenant)

The four JSON templates (`custom-service`, `metric-event`, `alerting-profile`, `auto-tag`) are
**realistic scaffolds, not tenant-verified**. Dynatrace Settings 2.0 schemas evolve and differ by
tenant version. Before relying on a live deploy:

1. `monaco download manifest.yaml --environment dynatrace-trial` (or pull specific schemas) to get
   the **exact** field shapes your tenant expects.
2. Reconcile `monaco/_templates/*.json` to match, then re-run `node scripts/gen-example.js`.
3. Confirm the custom-service config type for the chosen technology. `custom-service-nodejs` may not
   exist as a classic Config-API type on all versions — Node.js custom services may instead need a
   Settings 2.0 service-detection schema. Verify and adjust `_templates/config.yaml` + the mapper.
4. `monaco deploy ... --dry-run` until clean, then deploy for real.

Keep templates and the mapper token list (`monacoMapper.tokensFor`) in sync if you add fields.

## Conventions / guardrails

- Every object carries `lpl.managed-by=observability-as-code` — this is the OaC provenance marker the
  pipeline checks and the alerting profile filters on. Do not remove it.
- Validation logic lives in `lpl-benchmark.json` + `ci-validate.js`. The form, the server, and the
  pipeline must all agree — change the benchmark in one place and keep the CI checks aligned.
- Never commit secrets. Tokens come from env / `.env` (gitignored) / GitHub Actions secrets.
- Dynatrace is the priority tool for this engagement; keep it first in any docs you touch.

## Common tasks

- Run locally (no GitHub needed): `cd server && npm i && DRY_RUN=1 npm start`, open `:8080`.
- Real PRs: set `GITHUB_TOKEN` + `GITHUB_REPOSITORY`, `cd server && npm start`.
- Regenerate the worked example: `node scripts/gen-example.js`.
- Manual deploy (what merge does): `bash scripts/deploy-monaco.sh --dry-run` then without the flag.
