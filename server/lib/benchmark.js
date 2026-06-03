"use strict";

const fs = require("fs");
const path = require("path");

const benchmark = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "benchmark", "lpl-benchmark.json"), "utf8")
);

/**
 * Validate a raw form submission against the LPL Observability Standard Benchmark v4.
 * Returns { ok: boolean, errors: string[], normalized: object }.
 *
 * This is the "benchmark check" gate. The submission handler refuses to open a PR
 * unless this passes, and the GitHub Actions pipeline re-runs the same checks.
 */
function validateSubmission(input) {
  const errors = [];
  const b = benchmark;
  const s = input || {};

  const required = [
    "serviceName", "technology", "entryPoint", "owningTeam",
    "environment", "serviceTier", "costCenter", "sliMetric", "threshold", "severity"
  ];
  for (const f of required) {
    if (s[f] === undefined || s[f] === null || String(s[f]).trim() === "") {
      errors.push(`Missing required field: ${f}`);
    }
  }
  // Stop early if core fields are absent — downstream checks would be noise.
  if (errors.length) return { ok: false, errors, normalized: null };

  const serviceName = String(s.serviceName).trim();
  const technology = String(s.technology).trim().toLowerCase();
  const environment = String(s.environment).trim().toUpperCase();
  const serviceTier = String(s.serviceTier).trim();
  const severity = String(s.severity).trim().toUpperCase();
  const sliMetric = String(s.sliMetric).trim();
  const threshold = Number(s.threshold);

  if (!new RegExp(b.namingRules.serviceNameRegex).test(serviceName)) {
    errors.push(`serviceName "${serviceName}" does not match required pattern ${b.namingRules.serviceNameRegex}`);
  }
  if (!b.allowedTechnologies.includes(technology)) {
    errors.push(`technology "${technology}" not allowed. Allowed: ${b.allowedTechnologies.join(", ")}`);
  }
  if (!b.allowedEnvironments.includes(environment)) {
    errors.push(`environment "${environment}" not allowed. Allowed: ${b.allowedEnvironments.join(", ")}`);
  }
  if (!b.allowedServiceTiers.includes(serviceTier)) {
    errors.push(`serviceTier "${serviceTier}" not allowed. Allowed: ${b.allowedServiceTiers.join(", ")}`);
  }
  if (!b.allowedSeverities.includes(severity)) {
    errors.push(`severity "${severity}" not allowed. Allowed: ${b.allowedSeverities.join(", ")}`);
  }
  if (!b.sli.allowedMetrics.includes(sliMetric)) {
    errors.push(`sliMetric "${sliMetric}" not allowed. Allowed: ${b.sli.allowedMetrics.join(", ")}`);
  }
  if (Number.isNaN(threshold)) {
    errors.push(`threshold must be numeric (got "${s.threshold}")`);
  } else if (b.sli.thresholdRules[sliMetric]) {
    const rule = b.sli.thresholdRules[sliMetric];
    if (threshold < rule.min || threshold > rule.max) {
      errors.push(`threshold ${threshold} out of range for ${sliMetric} (${rule.min}-${rule.max} ${rule.unit})`);
    }
  }

  if (errors.length) return { ok: false, errors, normalized: null };

  const configId = slug(serviceName);
  if (!new RegExp(b.namingRules.configIdRegex).test(configId)) {
    errors.push(`derived configId "${configId}" invalid; choose a simpler service name`);
    return { ok: false, errors, normalized: null };
  }

  const normalized = {
    serviceName,
    configId,
    technology,
    entryPoint: String(s.entryPoint).trim(),
    owningTeam: String(s.owningTeam).trim(),
    environment,
    serviceTier,
    costCenter: String(s.costCenter).trim(),
    sliMetric,
    threshold,
    severity,
    dtSeverity: b.severityModel[severity].dtSeverity,
    alertDelayMinutes: b.severityModel[severity].alertingProfileDelayMinutes,
    notificationTarget: String(s.notificationTarget || "").trim(),
    // mandatory tags resolved from submission + provenance marker
    tags: resolveTags(b, { owningTeam: s.owningTeam, environment, serviceTier, costCenter: s.costCenter })
  };

  return { ok: true, errors: [], normalized };
}

function resolveTags(b, ctx) {
  return b.mandatoryTags.map((t) => {
    if (t.value) return { key: t.key, value: t.value };
    const v = ctx[t.source];
    return { key: t.key, value: String(v).trim() };
  });
}

function slug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

module.exports = { validateSubmission, benchmark, slug };
