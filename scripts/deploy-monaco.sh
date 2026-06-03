#!/usr/bin/env bash
# Manual deploy (what the pipeline does on merge). Requires DT_ENV_URL + DT_API_TOKEN.
set -euo pipefail
cd "$(dirname "$0")/../monaco"
ARG="${1:-}"
if [[ "$ARG" == "--dry-run" ]]; then
  monaco deploy manifest.yaml --environment dynatrace-trial --dry-run
else
  monaco deploy manifest.yaml --environment dynatrace-trial
fi
