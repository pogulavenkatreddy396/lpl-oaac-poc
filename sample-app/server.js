"use strict";

// Minimal Node.js service for the POC. OneAgent auto-instruments it once installed
// on the host. The /trading endpoint is the service boundary referenced by the
// example custom-service config (entry point: routes/trading.js).
//
// Use /load to drive traffic so the custom service materializes in Dynatrace,
// and /load?slow=1 or /load?error=1 to breach the response-time / error-rate
// threshold and fire the alert during the demo.

const express = require("express");
const app = express();
const PORT = process.env.SAMPLE_PORT || 3000;

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

app.get("/health", (_req, res) => res.json({ status: "ok" }));

// Pretend trading endpoint — this is the boundary the custom service detects.
app.get("/trading", async (req, res) => {
  const slow = req.query.slow === "1";
  const fail = req.query.error === "1";
  if (slow) await sleep(2500);          // > 2s, trips a response-time alert
  if (fail) return res.status(500).json({ error: "simulated downstream failure" });
  res.json({ order: "ABC123", status: "filled", latencyHint: slow ? "slow" : "normal" });
});

// Fire-and-forget load generator: hammer /trading N times.
app.get("/load", async (req, res) => {
  const n = Math.min(parseInt(req.query.n || "50", 10), 500);
  const qs = [];
  if (req.query.slow === "1") qs.push("slow=1");
  if (req.query.error === "1") qs.push("error=1");
  const suffix = qs.length ? "?" + qs.join("&") : "";
  let done = 0;
  for (let i = 0; i < n; i++) {
    try {
      await fetch(`http://localhost:${PORT}/trading${suffix}`);
      done++;
    } catch (_) { /* ignore */ }
  }
  res.json({ requested: n, completed: done, profile: suffix || "normal" });
});

app.listen(PORT, () => console.log(`sample trading service on :${PORT}`));
