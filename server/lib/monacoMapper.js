"use strict";

const fs = require("fs");
const path = require("path");

const TEMPLATE_DIR = path.join(__dirname, "..", "..", "monaco", "_templates");
const SERVICES_DIR = path.join(
  __dirname, "..", "..", "monaco", "projects", "lpl-observability", "services"
);
const TEMPLATE_FILES = ["config.yaml", "custom-service.json", "metric-event.json", "alerting-profile.json", "auto-tag.json"];

/**
 * Build the token map from a normalized (benchmark-validated) submission.
 */
function tokensFor(n) {
  return {
    "{{SERVICE_NAME}}": n.serviceName,
    "{{CONFIG_ID}}": n.configId,
    "{{TECHNOLOGY}}": n.technology,
    "{{ENTRY_POINT}}": n.entryPoint,
    "{{OWNING_TEAM}}": n.owningTeam,
    "{{ENVIRONMENT}}": n.environment,
    "{{SERVICE_TIER}}": n.serviceTier,
    "{{COST_CENTER}}": n.costCenter,
    "{{SLI_METRIC}}": n.sliMetric,
    "{{THRESHOLD}}": String(n.threshold),
    "{{SEVERITY}}": n.severity,
    "{{DT_SEVERITY}}": n.dtSeverity,
    "{{ALERT_DELAY_MINUTES}}": String(n.alertDelayMinutes)
  };
}

function render(text, tokens) {
  return Object.entries(tokens).reduce(
    (acc, [k, v]) => acc.split(k).join(v),
    text
  );
}

/**
 * Render all templates for a service into an in-memory file map.
 * Returns { relDir, files: [{ relPath, content }] } — content only, no disk write,
 * so the caller (GitHub layer) can commit them directly.
 */
function renderService(normalized) {
  const tokens = tokensFor(normalized);
  const relDir = path.posix.join(
    "monaco", "projects", "lpl-observability", "services", normalized.configId
  );
  const files = TEMPLATE_FILES.map((name) => {
    const raw = fs.readFileSync(path.join(TEMPLATE_DIR, name), "utf8");
    const content = render(raw, tokens);
    if (name.endsWith(".json")) JSON.parse(content); // fail fast on malformed render
    return { relPath: path.posix.join(relDir, name), content };
  });
  return { relDir, files };
}

/**
 * Optional local write (used by the example generator and for local dry-runs).
 */
function writeServiceLocally(normalized) {
  const { relDir, files } = renderService(normalized);
  const absDir = path.join(SERVICES_DIR, normalized.configId);
  fs.mkdirSync(absDir, { recursive: true });
  for (const f of files) {
    fs.writeFileSync(path.join(absDir, path.basename(f.relPath)), f.content);
  }
  return relDir;
}

module.exports = { renderService, writeServiceLocally, tokensFor, render };
