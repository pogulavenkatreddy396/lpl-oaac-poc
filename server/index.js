"use strict";

const express = require("express");
const path = require("path");
const fs = require("fs");

const { validateSubmission, benchmark } = require("./lib/benchmark");
const { renderService } = require("./lib/monacoMapper");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "form")));

const PORT = process.env.PORT || 8080;
// DRY_RUN=1 (default when no GITHUB_TOKEN) returns the rendered config without opening a PR.
const DRY_RUN = process.env.DRY_RUN === "1" || !process.env.GITHUB_TOKEN;

// Expose benchmark vocab so the form can self-populate its dropdowns.
app.get("/api/benchmark", (_req, res) => {
  res.json({
    allowedTechnologies: benchmark.allowedTechnologies,
    allowedEnvironments: benchmark.allowedEnvironments,
    allowedServiceTiers: benchmark.allowedServiceTiers,
    allowedSeverities: benchmark.allowedSeverities,
    allowedMetrics: benchmark.sli.allowedMetrics,
    severityModel: benchmark.severityModel
  });
});

app.post("/api/submit", async (req, res) => {
  const { ok, errors, normalized } = validateSubmission(req.body);
  if (!ok) {
    return res.status(422).json({ ok: false, stage: "benchmark-check", errors });
  }

  let rendered;
  try {
    rendered = renderService(normalized);
  } catch (e) {
    return res.status(500).json({ ok: false, stage: "render", errors: [e.message] });
  }

  const prBody = buildPrBody(normalized);

  if (DRY_RUN) {
    return res.json({
      ok: true,
      mode: "dry-run",
      message: "Validated and rendered. Set GITHUB_TOKEN + GITHUB_REPOSITORY to open a real PR.",
      relDir: rendered.relDir,
      files: rendered.files.map((f) => f.relPath),
      preview: rendered.files
    });
  }

  try {
    const { openServicePR } = require("./lib/github");
    const pr = await openServicePR({ normalized, files: rendered.files, prBody });
    return res.json({
      ok: true,
      mode: "pull-request",
      message: `PR #${pr.number} opened. Review + merge to deploy via the pipeline.`,
      pr
    });
  } catch (e) {
    return res.status(502).json({ ok: false, stage: "github", errors: [e.message] });
  }
});

function buildPrBody(n) {
  return [
    "## OaC self-service instrumentation request",
    "",
    "Auto-generated from the dev-team intake form. Benchmark check passed before this PR was opened.",
    "",
    "| Field | Value |",
    "| --- | --- |",
    `| Service | ${n.serviceName} |`,
    `| Technology | ${n.technology} |`,
    `| Entry point | \`${n.entryPoint}\` |`,
    `| Owning team | ${n.owningTeam} |`,
    `| Environment | ${n.environment} |`,
    `| Service tier | ${n.serviceTier} |`,
    `| Cost center | ${n.costCenter} |`,
    `| SLI metric | \`${n.sliMetric}\` |`,
    `| Threshold | ${n.threshold} |`,
    `| Severity | ${n.severity} → ${n.dtSeverity} (delay ${n.alertDelayMinutes}m) |`,
    `| Notification target | ${n.notificationTarget || "(default routing)"} |`,
    "",
    "**Benchmark reference:** LPL Observability Standard Benchmark v4",
    "**Change type:** Add custom service detection + custom alert (Monaco v2)",
    "**Rollback plan:** revert this PR; pipeline redeploys prior state from main.",
    "**Test evidence:** populated by the pipeline dry-run stage on this PR.",
    "",
    "_Tags applied: " + n.tags.map((t) => `\`${t.key}=${t.value}\``).join(", ") + "_"
  ].join("\n");
}

app.listen(PORT, () => {
  console.log(`OaC submission handler on :${PORT} (${DRY_RUN ? "DRY-RUN" : "PR"} mode)`);
});
