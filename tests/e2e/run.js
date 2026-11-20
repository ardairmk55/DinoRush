// Tüm tarayıcı testlerini sırayla çalıştırır: npm run test:e2e  (tek test: node tests/e2e/run.js features)
"use strict";
const { spawnSync } = require("child_process");
const path = require("path");

const SUITES = ["core", "features", "store-settings", "layout", "riko", "music"];
const only = process.argv.slice(2);
const list = only.length ? SUITES.filter(s => only.includes(s)) : SUITES;
const results = [];
for (const name of list) {
  const started = Date.now();
  console.log(`\n=== ${name} ===`);
  const r = spawnSync(process.execPath, [path.join(__dirname, name + ".e2e.js")], { stdio: "inherit" });
  results.push({ name, ok: r.status === 0, sec: Math.round((Date.now() - started) / 1000) });
}
console.log("\n=== Özet ===");
for (const r of results) console.log(`${r.ok ? "GEÇTİ" : "KALDI"}  ${r.name} (${r.sec} sn)`);
process.exitCode = results.every(r => r.ok) ? 0 : 1;
