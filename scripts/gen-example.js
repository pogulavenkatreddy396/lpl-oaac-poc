// Generates the committed worked-example service folder so the repo is demoable as-is.
const { validateSubmission } = require("../server/lib/benchmark");
const { writeServiceLocally } = require("../server/lib/monacoMapper");
const sample = {
  serviceName: "ClientWorks Trading API",
  technology: "nodejs",
  entryPoint: "routes/trading.js",
  owningTeam: "trading-platform",
  environment: "PROD_EAST",
  serviceTier: "1",
  costCenter: "CC-4821",
  sliMetric: "builtin:service.response.time",
  threshold: 2000000,
  severity: "P1",
  notificationTarget: "#trading-alerts"
};
const { ok, errors, normalized } = validateSubmission(sample);
if (!ok) { console.error(errors); process.exit(1); }
console.log("wrote", writeServiceLocally(normalized));
