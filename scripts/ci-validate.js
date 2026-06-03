"use strict";

/* Pipeline gate checks. Usage: node scripts/ci-validate.js <syntax|tags|benchmark>
 * Scans every monaco/projects/lpl-observability/services/<svc> folder.
 * Exits non-zero with a clear message on the first failure. */

const fs = require("fs");
const path = require("path");

const SERVICES = path.join(__dirname, "..", "monaco", "projects", "lpl-observability", "services");
const REQUIRED_FILES = ["config.yaml", "custom-service.json", "metric-event.json", "alerting-profile.json", "auto-tag.json"];

function serviceDirs() {
  if (!fs.existsSync(SERVICES)) return [];
  return fs.readdirSync(SERVICES)
    .filter((d) => fs.statSync(path.join(SERVICES, d)).isDirectory());
}

function fail(msg) { console.error("FAIL: " + msg); process.exit(1); }

function checkSyntax() {
  for (const d of serviceDirs()) {
    for (const f of REQUIRED_FILES) {
      const p = path.join(SERVICES, d, f);
      if (!fs.existsSync(p)) fail(`${d}: missing ${f}`);
      if (f.endsWith(".json")) {
        try { JSON.parse(fs.readFileSync(p, "utf8")); }
        catch (e) { fail(`${d}/${f}: invalid JSON — ${e.message}`); }
      }
    }
  }
  console.log("syntax OK");
}

function checkTags() {
  for (const d of serviceDirs()) {
    const autotag = fs.readFileSync(path.join(SERVICES, d, "auto-tag.json"), "utf8");
    if (!autotag.includes("observability-as-code")) {
      fail(`${d}: auto-tag missing the lpl.managed-by=observability-as-code provenance marker`);
    }
    const profile = fs.readFileSync(path.join(SERVICES, d, "alerting-profile.json"), "utf8");
    if (!profile.includes("lpl.managed-by")) {
      fail(`${d}: alerting profile does not filter on the OaC provenance tag`);
    }
  }
  console.log("tags OK");
}

function checkBenchmark() {
  const allowedSev = ["AVAILABILITY", "ERROR", "PERFORMANCE"];
  for (const d of serviceDirs()) {
    const me = JSON.parse(fs.readFileSync(path.join(SERVICES, d, "metric-event.json"), "utf8"));
    const sev = me.eventTemplate && me.eventTemplate.eventType;
    if (!allowedSev.includes(sev)) {
      fail(`${d}: metric-event eventType "${sev}" not in benchmark severity model`);
    }
    if (typeof me.modelProperties.threshold !== "number") {
      fail(`${d}: metric-event threshold must be numeric`);
    }
  }
  console.log("benchmark OK");
}

const mode = process.argv[2];
({ syntax: checkSyntax, tags: checkTags, benchmark: checkBenchmark }[mode] ||
  (() => fail(`unknown mode "${mode}"`)))();
