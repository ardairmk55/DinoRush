// Tarayıcı testleri için ortak yardımcılar (npm run test:e2e).
"use strict";
const path = require("path");
const fs = require("fs");

const ROOT = path.resolve(__dirname, "..", "..").replace(/\\/g, "/");

/**
 * Chromium yolu: CHROMIUM_PATH ortam değişkeni, yoksa Windows'ta yerel Playwright önbelleğindeki headless shell.
 * Bulunamazsa playwright-core kendi kurulu tarayıcısını kullanır (CI: npx playwright-core install chromium).
 */
function findChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const base = process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "ms-playwright") : null;
  if (base && fs.existsSync(base)) {
    const dirs = fs.readdirSync(base).filter(n => n.startsWith("chromium_headless_shell-")).sort().reverse();
    for (const d of dirs) {
      const p = path.join(base, d, "chrome-headless-shell-win64", "chrome-headless-shell.exe");
      if (fs.existsSync(p)) return p;
    }
  }
  return undefined;
}

function launchOptions() {
  const p = findChromium();
  return p ? { executablePath: p } : {};
}

module.exports = { ROOT, launchOptions, fixture: name => path.join(__dirname, "fixtures", name) };
