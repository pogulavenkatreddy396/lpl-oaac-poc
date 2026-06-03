# RUNBOOK — EC2 setup for the OaC Phase 2 POC

Follow top to bottom. Target host: **Ubuntu 24.04 LTS** EC2 instance. Everything below assumes the
repo is already on GitHub (see step 6) and you'll clone it onto the box.

> Time-box reminder: the Dynatrace free tier is a **15-day trial**. Provision it close to demo day.
> Build/iterate everything else against the API contract; only the live tenant is on the clock.

---

## 1. Prerequisites (accounts + signups)

- **AWS account** with permission to launch EC2.
- **GitHub account** and an (empty) repo for this project.
- **Dynatrace free trial** — sign up at dynatrace.com/signup; pick a US region. You get a dedicated
  SaaS tenant URL like `https://abc12345.live.dynatrace.com`.
- **Anthropic API key** (console.anthropic.com) for headless Claude Code, or a Claude subscription.

---

## 2. Provision the EC2 instance

| Setting | Value |
| --- | --- |
| AMI | Ubuntu Server 24.04 LTS (x86_64) |
| Instance type | `t3.large` (2 vCPU / 8 GB — comfortable for OneAgent + Node + Monaco + Claude Code) |
| Region | `us-east-1` (or your preference; keep it near you) |
| Key pair | create/download a `.pem` for SSH |
| Storage | 20 GB gp3 |

**Security group**

| Direction | Type | Port | Source | Why |
| --- | --- | --- | --- | --- |
| Inbound | SSH | 22 | **your IP only** | shell access |
| Inbound | Custom TCP | 8080 | your IP only | the intake form (or use an SSH tunnel and skip this) |
| Outbound | All | all | 0.0.0.0/0 | reach Anthropic API, GitHub, npm, Dynatrace (open by default) |

Tip: instead of opening 8080, tunnel it — `ssh -i key.pem -L 8080:localhost:8080 ubuntu@<ip>` — and
browse `http://localhost:8080` locally. Safer for a demo box.

No IAM role is required: Dynatrace is SaaS and Monaco talks to it over HTTPS with an API token.

---

## 3. Connect

```bash
chmod 400 your-key.pem
ssh -i your-key.pem ubuntu@<EC2_PUBLIC_IP>
```

---

## 4. Install the toolchain

Clone, then run the bootstrap (installs Node 20, git, Monaco v2, Claude Code, and npm deps):

```bash
git clone https://github.com/<you>/lpl-oaac-poc.git
cd lpl-oaac-poc
bash scripts/bootstrap-ec2.sh
```

Then install **Dynatrace OneAgent** (this is the only manual install — the command carries your
tenant URL + a PaaS token):

1. In Dynatrace: **Deploy Dynatrace → Start installation → Linux**.
2. Copy the generated one-liner and run it on the EC2 box.
3. Within a minute the host appears under **Hosts** in Dynatrace.

---

## 5. Permissions & secrets

**Dynatrace API token** — in Dynatrace: **Access Tokens → Generate new token**. Scopes:
`settings.read`, `settings.write`, `ReadConfig`, `WriteConfig`, `DataExport`, `entities.read`.

**GitHub token** — a fine-grained PAT scoped to this repo with **Contents: write** and
**Pull requests: write** (lets the handler open PRs). For Actions to deploy, also add the Dynatrace
secrets to the repo: **Settings → Secrets and variables → Actions** → `DT_ENV_URL`, `DT_API_TOKEN`.

**Export on the box** (or copy `.env.example` to `.env` and fill it in):

```bash
export DT_ENV_URL="https://abc12345.live.dynatrace.com"
export DT_API_TOKEN="dt0c01...."
export GITHUB_TOKEN="github_pat_...."
export GITHUB_REPOSITORY="<you>/lpl-oaac-poc"
export ANTHROPIC_API_KEY="sk-ant-...."
```

Headless Claude Code auth: setting `ANTHROPIC_API_KEY` is the simplest path on a server with no
browser. (Alternatively, run the OAuth login over an SSH tunnel.)

---

## 6. Get the build onto EC2 (one-time, from your laptop / this bundle)

```bash
# from the unzipped bundle on your machine:
GITHUB_REPO=git@github.com:<you>/lpl-oaac-poc.git bash scripts/push-to-github.sh
# then on EC2:  git clone https://github.com/<you>/lpl-oaac-poc.git
```

---

## 7. Run it end to end

```bash
# terminal 1 — sample service (gets auto-instrumented by OneAgent)
cd ~/lpl-oaac-poc/sample-app && npm start

# terminal 2 — submission handler (PR mode, since GITHUB_TOKEN is set)
cd ~/lpl-oaac-poc/server && npm start
```

Drive traffic so the service appears in Dynatrace, then demo:

```bash
curl "http://localhost:3000/load?n=100"          # normal traffic → service materializes
```

Now the loop:

1. Open the form (`http://localhost:8080` or your tunnel). Submit a request for the sample service.
2. The handler opens a **PR**. Review it (note the auto-filled governance body), approve, **merge**.
3. GitHub Actions runs the gates and deploys via Monaco to your trial tenant.
4. In Dynatrace: the **custom service**, **alert (metric event)**, **alerting profile**, and **tag**
   appear. Trip the alert live:

   ```bash
   curl "http://localhost:3000/load?n=120&slow=1"   # > 2s responses → P1 alert fires
   ```

That's the whole story: form → governed PR → pipeline → live, code-defined observability.

> First live deploy: run `bash scripts/deploy-monaco.sh --dry-run` and reconcile any schema
> mismatches per **CLAUDE.md › "Schema truth"** before merging for real.

---

## 8. Use Claude Code on the box

```bash
cd ~/lpl-oaac-poc
claude            # CLAUDE.md auto-loads; it has the full project map + guardrails
```

Useful prompts:

- "Run `monaco download` against the trial tenant and reconcile the JSON templates with the real schemas."
- "Add an SLO config type to the per-service template and wire it into the pipeline gates."
- "The dry-run failed on the metric-event schema — read the error and fix the template."

This is the 'speed' proof: the same agent that built the scaffold finishes and hardens it in place.

---

## 9. Trial expiry / teardown

- The trial tenant stops after 15 days; monitoring data is retained ~30 days, then gone.
- The **repo is the source of truth** — re-point `DT_ENV_URL`/`DT_API_TOKEN` at a fresh tenant and
  `monaco deploy` rebuilds everything. Nothing lives only in the UI.
- Stop or terminate the EC2 instance when done to avoid charges.
