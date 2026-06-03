#!/usr/bin/env bash
# One-time: turn this bundle into a GitHub repo. Run from the repo root.
#   GITHUB_REPO=git@github.com:youruser/lpl-oaac-poc.git bash scripts/push-to-github.sh
set -euo pipefail
: "${GITHUB_REPO:?set GITHUB_REPO to your empty remote, e.g. git@github.com:you/lpl-oaac-poc.git}"

git init -b main
git add .
git commit -m "OaC Phase 2 POC: self-service Dynatrace instrumentation (initial scaffold)"
git remote add origin "$GITHUB_REPO"
git push -u origin main
echo "Pushed. Now clone on EC2:  git clone $GITHUB_REPO"
