#!/usr/bin/env bash
# Provision toolchain on a fresh Ubuntu 24.04 EC2 instance for the OaC POC.
# Run AFTER cloning this repo onto the box:  bash scripts/bootstrap-ec2.sh
set -euo pipefail

MONACO_VERSION="${MONACO_VERSION:-2.18.0}"   # verify latest on the releases page

echo "==> system packages"
sudo apt-get update -y
sudo apt-get install -y curl git unzip

echo "==> Node.js 20 LTS"
if ! command -v node >/dev/null || [[ "$(node -v)" != v20* && "$(node -v)" != v22* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
node -v && npm -v

echo "==> Monaco v2 (Dynatrace Configuration as Code)"
curl -fsSL -o /tmp/monaco \
  "https://github.com/Dynatrace/dynatrace-configuration-as-code/releases/download/v${MONACO_VERSION}/monaco-linux-amd64"
chmod +x /tmp/monaco && sudo mv /tmp/monaco /usr/local/bin/monaco
monaco version || true

echo "==> Claude Code (npm install; native installer is an alternative)"
sudo npm install -g @anthropic-ai/claude-code@latest
claude --version || true

echo "==> npm deps for server + sample app"
( cd "$(dirname "$0")/../server" && npm install )
( cd "$(dirname "$0")/../sample-app" && npm install )

cat <<'NOTE'

NEXT (manual, see docs/RUNBOOK.md):
  * Install Dynatrace OneAgent from your trial tenant:
      Deploy Dynatrace > Start installation > Linux > copy the one-liner (carries your tenant URL + PaaS token).
  * Export secrets:  DT_ENV_URL, DT_API_TOKEN, GITHUB_TOKEN, GITHUB_REPOSITORY, ANTHROPIC_API_KEY
  * Start the sample app, then the submission handler.
NOTE
